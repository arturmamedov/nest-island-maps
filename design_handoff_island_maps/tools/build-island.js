/* Geometry pipeline used to make data/geometry/*.geo.json — reference implementation (browser canvas).
   Inputs (injected as function params in the design tool): KEY (island key in raw-osm-coastlines.json), BOX [x0,y0,x1,y1]
   the artboard box the island is fitted into, POINTS {name:[lat,lng]} to test, BG optional overlay image, BLUR coast smoothing px.
   Used: tenerife BOX [200,253,843,825] BLUR 2.2 · gran_canaria BOX [295,289,771,812] BLUR 2.2 · ibiza BOX [230,240,850,840] BLUR 4.2.
   Port to Node with @napi-rs/canvas (Path2D, filter) or replace the blur+trace with a polygon offset library. */

const raw = JSON.parse(await readFile('geo/raw-osm.json'));
const W=1080, PAD=300, K=1.25, G=Math.round((W+2*PAD)*K);
const merc = f => Math.log(Math.tan(Math.PI/4 + f*Math.PI/360));
const pts0 = raw[KEY].map(([l,f])=>[l*Math.PI/180, merc(f)]);
let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9; for(const [x,y] of pts0){mnx=Math.min(mnx,x);mxx=Math.max(mxx,x);mny=Math.min(mny,y);mxy=Math.max(mxy,y);}
const box=BOX;
const s=Math.min((box[2]-box[0])/(mxx-mnx),(box[3]-box[1])/(mxy-mny));
const lamC=(mnx+mxx)/2, mC=(mny+mxy)/2, cx=(box[0]+box[2])/2, cy=(box[1]+box[3])/2;
const P=([x,y])=>[cx+(x-lamC)*s, cy-(y-mC)*s];
const PL=(lat,lng)=>P([lng*Math.PI/180, merc(lat)]);
const island = pts0.map(P);
const g2a=v=>v/K-PAD, a2g=v=>(v+PAD)*K;
function dpOpen(pts,tol){ const keep=new Uint8Array(pts.length); keep[0]=keep[pts.length-1]=1; const st=[[0,pts.length-1]];
  while(st.length){const [a,b]=st.pop(); let md=0,mi=-1; const [ax,ay]=pts[a],[bx,by]=pts[b]; const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy);
    for(let i=a+1;i<b;i++){const d=L<1e-9?Math.hypot(pts[i][0]-ax,pts[i][1]-ay):Math.abs((pts[i][0]-ax)*dy-(pts[i][1]-ay)*dx)/L; if(d>md){md=d;mi=i;}}
    if(md>tol){keep[mi]=1; st.push([a,mi],[mi,b]);}}
  return pts.filter((_,i)=>keep[i]); }
function dp(pts,tol){ let m=0,md=0; for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1]); if(d>md){md=d;m=i;}}
  const a=dpOpen(pts.slice(0,m+1),tol), b=dpOpen(pts.slice(m),tol); return a.concat(b.slice(1,-1)); }
const toD = pts => 'M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L')+'Z';
const n=G;
function contour(F, level){ const segs=[];
  const ip=(x0,y0,v0,x1,y1,v1)=>{const t=v0/(v0-v1);return [x0+(x1-x0)*t,y0+(y1-y0)*t];};
  for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){
    const a=F[y*n+x]-level,b=F[y*n+x+1]-level,c=F[(y+1)*n+x+1]-level,d=F[(y+1)*n+x]-level;
    const idx=(a>=0?8:0)|(b>=0?4:0)|(c>=0?2:0)|(d>=0?1:0); if(idx===0||idx===15)continue;
    const T=()=>ip(x,y,a,x+1,y,b), R=()=>ip(x+1,y,b,x+1,y+1,c), B=()=>ip(x,y+1,d,x+1,y+1,c), L=()=>ip(x,y,a,x,y+1,d);
    switch(idx){case 1:case 14:segs.push([L(),B()]);break;case 2:case 13:segs.push([B(),R()]);break;case 3:case 12:segs.push([L(),R()]);break;case 4:case 11:segs.push([T(),R()]);break;case 6:case 9:segs.push([T(),B()]);break;case 7:case 8:segs.push([L(),T()]);break;case 5:segs.push([L(),T()],[B(),R()]);break;case 10:segs.push([T(),R()],[L(),B()]);break;}}
  const key=p=>Math.round(p[0]*1000)+','+Math.round(p[1]*1000); const map=new Map();
  segs.forEach((s,i)=>{for(const e of [0,1]){const k=key(s[e]);if(!map.has(k))map.set(k,[]);map.get(k).push(i);}});
  const used=new Uint8Array(segs.length); let best=[];
  for(let i=0;i<segs.length;i++){ if(used[i])continue; used[i]=1; const line=[segs[i][0],segs[i][1]];
    let go=true; while(go){go=false; const k=key(line[line.length-1]); for(const j of map.get(k)||[]){ if(used[j])continue; used[j]=1; const s=segs[j]; line.push(key(s[0])===k?s[1]:s[0]); go=true; break; }}
    if(line.length>best.length)best=line; }
  return best.map(([x,y])=>[g2a(x),g2a(y)]); }
const cv=createCanvas(G,G), c2=cv.getContext('2d'); c2.filter='blur('+BLUR+'px)'; c2.fillStyle='#000'; c2.beginPath(); island.forEach(([x,y],i)=>i?c2.lineTo(a2g(x),a2g(y)):c2.moveTo(a2g(x),a2g(y))); c2.closePath(); c2.fill();
const A=c2.getImageData(0,0,G,G).data; const Fa=new Float32Array(G*G); for(let i=0;i<G*G;i++)Fa[i]=A[i*4+3];
const islC=dp(contour(Fa,127.5),0.35);
const INF=1e20;
function edt(inside){ const f=new Float64Array(n*n); for(let i=0;i<n*n;i++) f[i]=inside[i]?0:INF;
  const tmp=new Float64Array(n), out=new Float64Array(n), v=new Int32Array(n), z=new Float64Array(n+1);
  const dt1=()=>{let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;for(let q=1;q<n;q++){let s=((tmp[q]+q*q)-(tmp[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);while(s<=z[k]){k--;s=((tmp[q]+q*q)-(tmp[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}k=0;for(let q=0;q<n;q++){while(z[k+1]<q)k++;out[q]=(q-v[k])*(q-v[k])+tmp[v[k]];}};
  for(let x=0;x<n;x++){for(let y=0;y<n;y++)tmp[y]=f[y*n+x];dt1();for(let y=0;y<n;y++)f[y*n+x]=out[y];}
  for(let y=0;y<n;y++){for(let x=0;x<n;x++)tmp[x]=f[y*n+x];dt1();for(let x=0;x<n;x++)f[y*n+x]=Math.sqrt(out[x]);}
  return f; }
const inI=new Uint8Array(G*G); for(let i=0;i<G*G;i++) inI[i]=Fa[i]>127?1:0;
const d1=edt(inI);
const offs=[22,62,102,160], clos=[8,26,48,75]; const rings=[];
for(let k=0;k<offs.length;k++){ const R=(offs[k]+clos[k])*K; const D=new Uint8Array(G*G); for(let i=0;i<G*G;i++) D[i]=d1[i]<=R?0:1;
  const d2=edt(D); rings.push(toD(dp(contour(d2, clos[k]*K),0.4))); }
const ip2=new Path2D(toD(islC)); const tc=createCanvas(10,10).getContext('2d');
const res={}; for(const [k,[la,ln]] of Object.entries(POINTS)){const [x,y]=PL(la,ln); res[k]=[+x.toFixed(0),+y.toFixed(0),tc.isPointInPath(ip2,x,y)?'in':'OUT'];}
log(KEY, JSON.stringify({s,lamC,mC,cx,cy}), islC.length);
log(JSON.stringify(res));
await saveFile('geo/'+KEY+'-vector.json', JSON.stringify({proj:{s,lamC,mC,cx,cy}, island: toD(islC), rings}));
const pv=createCanvas(1080,1080), p=pv.getContext('2d'); p.fillStyle='#fff';p.fillRect(0,0,1080,1080);
if (BG) { p.globalAlpha=0.5; p.drawImage(await readImage(BG),0,0); p.globalAlpha=1; }
p.lineWidth=1.5; p.strokeStyle='#e0245e'; p.stroke(ip2); p.strokeStyle='#1a56db'; for(const r of rings) p.stroke(new Path2D(r));
p.font='bold 13px sans-serif'; for(const [k,[la,ln]] of Object.entries(POINTS)){const [x,y]=PL(la,ln); p.fillStyle='#16a34a'; p.beginPath(); p.arc(x,y,4,0,7); p.fill(); p.fillStyle='#000'; p.fillText(k,x+6,y-4);}
await saveFile('geo/overlay-'+KEY+'.png', pv);
