import type { Point } from '../../src/shared/geo.js';

/* Marching squares, ported verbatim from tools/build-island.js lines 28–41,
   because the committed paths are this walk's output and its quirks are part
   of them:
   - samples sit at integer indices (index i is coordinate i), not at cell
     centres, which shifts every traced shape by half a cell;
   - a corner exactly on the level counts as inside (`>=`), and the saddles
     (cases 5 and 10) always join the inside corners;
   - segments are stitched through endpoint keys rounded to 1/1000, walking
     forward only, in insertion order, so at an exact tie the walk can run
     counter-clockwise;
   - only the line with the most points is kept: islets and holes drop out.
   Unlike the reference, it returns grid coordinates; the caller maps them to
   the artboard. */

/**
 * The longest contour line of `field` (n × n, row-major) at `level`, in grid
 * coordinates. A closed line ends on a copy of its first point.
 */
export function contour(field: Float64Array, n: number, level: number): Point[] {
  const segs: [Point, Point][] = [];
  const ip = (x0: number, y0: number, v0: number, x1: number, y1: number, v1: number): Point => {
    const t = v0 / (v0 - v1);
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
  };
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++) {
      const a = field[y * n + x] - level;
      const b = field[y * n + x + 1] - level;
      const c = field[(y + 1) * n + x + 1] - level;
      const d = field[(y + 1) * n + x] - level;
      const idx = (a >= 0 ? 8 : 0) | (b >= 0 ? 4 : 0) | (c >= 0 ? 2 : 0) | (d >= 0 ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      // Each edge is interpolated in one fixed direction, so the two cells sharing it compute the same point bit for bit.
      const T = () => ip(x, y, a, x + 1, y, b);
      const R = () => ip(x + 1, y, b, x + 1, y + 1, c);
      const B = () => ip(x, y + 1, d, x + 1, y + 1, c);
      const L = () => ip(x, y, a, x, y + 1, d);
      switch (idx) {
        case 1:
        case 14:
          segs.push([L(), B()]);
          break;
        case 2:
        case 13:
          segs.push([B(), R()]);
          break;
        case 3:
        case 12:
          segs.push([L(), R()]);
          break;
        case 4:
        case 11:
          segs.push([T(), R()]);
          break;
        case 6:
        case 9:
          segs.push([T(), B()]);
          break;
        case 7:
        case 8:
          segs.push([L(), T()]);
          break;
        case 5:
          segs.push([L(), T()], [B(), R()]);
          break;
        case 10:
          segs.push([T(), R()], [L(), B()]);
          break;
      }
    }

  const key = (p: Point) => Math.round(p.x * 1000) + ',' + Math.round(p.y * 1000);
  const map = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const e of [0, 1] as const) {
      const k = key(s[e]);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    }
  });
  const used = new Uint8Array(segs.length);
  let best: Point[] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [segs[i]![0], segs[i]![1]];
    let go = true;
    while (go) {
      go = false;
      const k = key(line[line.length - 1]!);
      for (const j of map.get(k) ?? []) {
        if (used[j]) continue;
        used[j] = 1;
        const s = segs[j]!;
        line.push(key(s[0]) === k ? s[1] : s[0]);
        go = true;
        break;
      }
    }
    if (line.length > best.length) best = line;
  }
  return best;
}
