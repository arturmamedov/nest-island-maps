import { parsePolygons, type Point, type Polygon } from '../../src/shared/geo.js';
import type { Geometry } from '../../src/shared/schema.js';
import { HAUSDORFF_STEP } from './config.js';

/* How the port is held to the committed geometry. The browser blur the
   committed paths came from can't be reproduced exactly, so the paths are
   compared by shape: the symmetric Hausdorff distance, the farthest any point
   of either polygon lies from the other. Everything else in the file must be
   byte-equal, so the projection constants can't drift (the seeds carry a
   copy of them). */

/** A distance and the point it was measured from. */
export type Distance = { distance: number; at: Point };

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/* Directed: samples a's outline every `step` or less, vertices included,
   and measures each sample to b's segments, the closing one included.
   Sampling can read up to step / 2 low.
   Early break (exact): once a sample is within the worst distance so far, it
   can't raise the maximum, so its scan stops. The scan starts at the segment
   nearest the previous sample, where a near one is likely. A sample that
   could raise the maximum is always scanned in full. */
function directed(a: Polygon, b: Polygon, step: number): Distance {
  let worst: Distance = { distance: 0, at: a[0]! };
  let hint = 0;
  for (let i = 0; i < a.length; i++) {
    const p = a[i]!;
    const q = a[(i + 1) % a.length]!;
    const pieces = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / step));
    for (let s = 0; s < pieces; s++) {
      const at = { x: p.x + ((q.x - p.x) * s) / pieces, y: p.y + ((q.y - p.y) * s) / pieces };
      let d = Infinity;
      let nearest = hint;
      for (let m = 0; m < b.length; m++) {
        const j = (hint + m) % b.length;
        const dj = segmentDistance(at, b[j]!, b[(j + 1) % b.length]!);
        if (dj < d) {
          d = dj;
          nearest = j;
        }
        if (d <= worst.distance) break;
      }
      hint = nearest;
      if (d > worst.distance) worst = { distance: d, at };
    }
  }
  return worst;
}

/** The symmetric Hausdorff distance between two closed polygons, and where the worse direction reaches it. */
export function hausdorff(a: Polygon, b: Polygon, step = HAUSDORFF_STEP): Distance {
  const ab = directed(a, b, step);
  const ba = directed(b, a, step);
  return ab.distance >= ba.distance ? ab : ba;
}

function onePolygon(d: string): Polygon {
  const polygons = parsePolygons(d);
  if (polygons.length !== 1) throw new Error(`Expected one closed polygon, got ${polygons.length}`);
  return polygons[0]!;
}

/** The coast and each ring of `built` measured against `committed`, and whether the rest of the two files is byte-equal. */
export function compareGeometry(built: Geometry, committed: Geometry): { sameOtherwise: boolean; paths: (Distance & { path: string })[] } {
  const withoutPaths = (g: Geometry) => JSON.stringify({ ...g, island: '', rings: g.rings.map((r) => ({ ...r, d: '' })) });
  const pairs = [
    { path: 'island', a: built.island, b: committed.island },
    ...built.rings.map((r, k) => ({ path: r.id, a: r.d, b: committed.rings[k]!.d })),
  ];
  return {
    sameOtherwise: withoutPaths(built) === withoutPaths(committed),
    paths: pairs.map(({ path, a, b }) => ({ path, ...hausdorff(onePolygon(a), onePolygon(b)) })),
  };
}
