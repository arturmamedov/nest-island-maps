/* Spherical Mercator fitted per island (handoff README §1 "Projection"), plus
   the little polygon maths the map needs without a DOM: the geometry files
   hold single M/L/Z polygons, so point-in-polygon is a plain ray cast.

   The formulas mirror tools/build-island.js operation for operation, so the
   fit reproduces the committed constants bit for bit (tests/unit/geo.test.ts). */

export type Point = { x: number; y: number };
export type Polygon = Point[];
export type ProjectionConstants = { s: number; lamC: number; mC: number; cx: number; cy: number };

const mercator = (latDeg: number) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));

export function project(p: ProjectionConstants, lat: number, lng: number): Point {
  return {
    x: p.cx + ((lng * Math.PI) / 180 - p.lamC) * p.s,
    y: p.cy - (mercator(lat) - p.mC) * p.s,
  };
}

export function unproject(p: ProjectionConstants, x: number, y: number): { lat: number; lng: number } {
  return {
    lng: (((x - p.cx) / p.s + p.lamC) * 180) / Math.PI,
    lat: ((2 * Math.atan(Math.exp(p.mC - (y - p.cy) / p.s)) - Math.PI / 2) * 180) / Math.PI,
  };
}

/** Fits a coastline ([lng, lat] pairs) uniformly into an artboard box [x0, y0, x1, y1]. */
export function fitProjection(coast: readonly (readonly [number, number])[], box: readonly [number, number, number, number]): ProjectionConstants {
  let mnx = Infinity;
  let mxx = -Infinity;
  let mny = Infinity;
  let mxy = -Infinity;
  for (const [lng, lat] of coast) {
    const x = (lng * Math.PI) / 180;
    const y = mercator(lat);
    mnx = Math.min(mnx, x);
    mxx = Math.max(mxx, x);
    mny = Math.min(mny, y);
    mxy = Math.max(mxy, y);
  }
  const [x0, y0, x1, y1] = box;
  return {
    s: Math.min((x1 - x0) / (mxx - mnx), (y1 - y0) / (mxy - mny)),
    lamC: (mnx + mxx) / 2,
    mC: (mny + mxy) / 2,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
  };
}

/** Parses path data made only of M, L and Z (what the geometry files hold). */
export function parsePolygons(d: string): Polygon[] {
  const polygons: Polygon[] = [];
  let current: Polygon | null = null;
  let command = '';
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (/[a-zA-Z]/.test(t)) {
      if (!'MLZ'.includes(t)) throw new Error(`Unsupported path command "${t}": geometry paths use only M, L and Z`);
      command = t;
      if (t === 'Z') current = null;
      continue;
    }
    const x = Number(t);
    const y = Number(tokens[++i]);
    if (Number.isNaN(y)) throw new Error('Path data ends in the middle of a point');
    if (command === 'M' || !current) {
      current = [];
      polygons.push(current);
      command = 'L'; // Coordinates after an M are implicit line-tos.
    }
    current.push({ x, y });
  }
  return polygons;
}

/** Even-odd ray cast over every polygon. */
export function pointInPolygons(polygons: readonly Polygon[], x: number, y: number): boolean {
  let inside = false;
  for (const poly of polygons) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]!;
      const b = poly[j]!;
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
  }
  return inside;
}
