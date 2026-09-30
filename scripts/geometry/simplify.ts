import type { Point } from '../../src/shared/geo.js';

/* Douglas–Peucker as tools/build-island.js lines 19–25 ran it, operation for
   operation, so the port keeps the same vertices the committed paths kept:
   the distance is to the infinite line through a run's ends (the point
   distance when the ends coincide), the first maximum wins, and a point is
   kept only when it lies strictly farther than the tolerance. */

/** Simplifies an open polyline; both ends are always kept. Iterative, so a long coast can't overflow the stack. */
export function dpOpen(pts: readonly Point[], tol: number): Point[] {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let md = 0;
    let mi = -1;
    const { x: ax, y: ay } = pts[a]!;
    const { x: bx, y: by } = pts[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const L = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const p = pts[i]!;
      const d = L < 1e-9 ? Math.hypot(p.x - ax, p.y - ay) : Math.abs((p.x - ax) * dy - (p.y - ay) * dx) / L;
      if (d > md) {
        md = d;
        mi = i;
      }
    }
    if (md > tol) {
      keep[mi] = 1;
      stack.push([a, mi], [mi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * Simplifies a closed ring given with its closing duplicate (last point =
 * first), as a contour comes back. The ring is split at the point farthest
 * from its start, so both of those survive; the result drops the duplicate.
 */
export function dp(pts: readonly Point[], tol: number): Point[] {
  let m = 0;
  let md = 0;
  const first = pts[0]!;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i]!.x - first.x, pts[i]!.y - first.y);
    if (d > md) {
      md = d;
      m = i;
    }
  }
  const a = dpOpen(pts.slice(0, m + 1), tol);
  const b = dpOpen(pts.slice(m), tol);
  return a.concat(b.slice(1, -1));
}
