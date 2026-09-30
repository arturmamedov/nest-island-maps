/* The exact Euclidean distance transform of Felzenszwalb and Huttenlocher
   (the lower envelope of parabolas), ported verbatim from
   tools/build-island.js lines 45–51: columns first, then rows, then square
   roots. The squared distances stay whole numbers, so every result is the
   correctly rounded square root of an integer. The ring thresholds rely on
   that: ring 2 dilates to exactly 110 cells, and `<=` must see 110 as 110. */

/** Stands for "no source yet" before the passes; large enough that any real distance wins. */
const INF = 1e20;

/**
 * Distance, in cells, from every cell of an n × n grid to the nearest source
 * cell (`sources[i] = 1`, which is at distance 0).
 */
export function edt(sources: Uint8Array, n: number): Float64Array {
  const f = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) f[i] = sources[i] ? 0 : INF;
  const tmp = new Float64Array(n);
  const out = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);

  // One dimension: out[q] = min over p of (q − p)² + tmp[p].
  const dt1 = () => {
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s = (tmp[q] + q * q - (tmp[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (tmp[q] + q * q - (tmp[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      out[q] = (q - v[k]) * (q - v[k]) + tmp[v[k]];
    }
  };

  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) tmp[y] = f[y * n + x];
    dt1();
    for (let y = 0; y < n; y++) f[y * n + x] = out[y];
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) tmp[x] = f[y * n + x];
    dt1();
    for (let x = 0; x < n; x++) f[y * n + x] = Math.sqrt(out[x]);
  }
  return f;
}
