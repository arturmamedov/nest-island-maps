import type { Point } from '../../src/shared/geo.js';

/* The coast fill, in place of the reference's canvas `fill()` (nonzero rule).
   Cell (i, j) covers [i, i+1] × [j, j+1] and is centred on (i + ½, j + ½),
   exactly like a canvas pixel. Contour later reads sample i as coordinate i,
   so every traced shape comes out half a cell up and left of its polygon —
   the reference's convention, which the committed paths carry, kept on
   purpose. Each cell row is sampled on `samples` sub-scanlines; along each,
   the spans inside the polygon add their exact horizontal overlap, so the
   field is each cell's covered fraction, 0–1. */

type Crossing = { x: number; dir: 1 | -1 };

/**
 * The coverage of an n × n grid (row-major) by one polygon given in grid
 * coordinates. The last vertex joins the first; a repeated closing vertex is
 * a zero-length edge and changes nothing. Either winding gives the same field.
 */
export function rasterise(polygon: readonly Point[], n: number, samples: number): Float64Array {
  const lines = n * samples;
  const crossings: Crossing[][] = Array.from({ length: lines }, () => []);
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    if (a.y === b.y) continue;
    // Walk every edge top to bottom, so its crossings don't depend on which way the polygon winds.
    const [top, bottom, dir] = a.y < b.y ? ([a, b, 1] as const) : ([b, a, -1] as const);
    for (let t = Math.max(0, Math.floor(top.y * samples - 0.5)); t < lines; t++) {
      const y = (t + 0.5) / samples;
      if (y >= bottom.y) break;
      if (y < top.y) continue; // half-open [top, bottom): a vertex on a sub-scanline counts once
      crossings[t]!.push({ x: top.x + ((y - top.y) * (bottom.x - top.x)) / (bottom.y - top.y), dir });
    }
  }

  const field = new Float64Array(n * n);
  crossings.forEach((row, t) => {
    if (!row.length) return;
    row.sort((p, q) => p.x - q.x);
    const base = Math.floor(t / samples) * n;
    let winding = 0;
    let start = 0;
    for (const c of row) {
      const before = winding;
      winding += c.dir;
      if (before === 0) start = c.x;
      else if (winding === 0) addSpan(field, base, n, start, c.x, samples);
    }
  });
  return field;
}

/** Adds one sub-scanline's span [x0, x1] to the cells of the row starting at `base`, each by its overlap. */
function addSpan(field: Float64Array, base: number, n: number, x0: number, x1: number, samples: number) {
  for (let i = Math.max(0, Math.floor(x0)), last = Math.min(n - 1, Math.floor(x1)); i <= last; i++) {
    const overlap = Math.min(x1, i + 1) - Math.max(x0, i);
    if (overlap > 0) field[base + i] += overlap / samples;
  }
}
