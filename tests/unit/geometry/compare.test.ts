import { describe, expect, it } from 'vitest';
import { GeometrySchema } from '../../../src/shared/schema.js';
import { compareGeometry, hausdorff } from '../../../scripts/geometry/compare.js';
import { committedText, square } from './helpers.js';

/* How `npm run geometry -- --check` measures the port against the committed
   files: the symmetric Hausdorff distance between closed polygons (the
   farthest any point of either lies from the other), plus byte equality of
   everything that isn't a path. */

describe('hausdorff', () => {
  it('is zero for the same polygon', () => {
    expect(hausdorff(square(0, 0, 10, 10), square(0, 0, 10, 10)).distance).toBeLessThan(1e-9);
  });

  it('is the offset of a shifted copy', () => {
    expect(hausdorff(square(0, 0, 10, 10), square(0.3, 0, 10.3, 10)).distance).toBeCloseTo(0.3, 9);
  });

  it('measures to segments, not vertices', () => {
    // The spike vertex is 1 from the square's edge, though 5.1 from its nearest corner.
    const spiked = [{ x: 0, y: 0 }, { x: 5, y: -1 }, ...square(0, 0, 10, 10).slice(1)];
    const h = hausdorff(square(0, 0, 10, 10), spiked);
    expect(h.distance).toBeCloseTo(1, 9);
    expect(h.at).toEqual({ x: 5, y: -1 });
  });

  it('takes the worse of both directions, whichever polygon comes first', () => {
    // Every point of the small square is 2 from the big one, but the big one's corners are 2√2 from the small one.
    const small = square(0, 0, 10, 10);
    const big = square(-2, -2, 12, 12);
    expect(hausdorff(small, big).distance).toBeCloseTo(2 * Math.SQRT2, 9);
    expect(hausdorff(big, small).distance).toBeCloseTo(2 * Math.SQRT2, 9);
  });
});

describe('compareGeometry (a build against a committed file’s text)', () => {
  const text = committedText('tenerife');
  const tenerife = GeometrySchema.parse(JSON.parse(text));
  // Tiny paths keep the rest fast: only what isn't a path differs.
  const small = structuredClone(tenerife);
  small.island = 'M0.0 0.0L10.0 0.0L10.0 10.0Z';
  for (const r of small.rings) r.d = small.island;
  const smallText = JSON.stringify(small);

  it('finds a committed file identical to itself', () => {
    const r = compareGeometry(tenerife, text);
    expect(r.sameOtherwise).toBe(true);
    expect(r.paths.map((p) => p.path)).toEqual(['island', 'ring-1', 'ring-2', 'ring-3', 'ring-4']);
    for (const p of r.paths) expect(p.distance).toBeLessThan(1e-9);
  });

  it('notices a changed projection constant or name, even with the same paths', () => {
    // (A 1e-12 change to `s` would round away: its ULP is about 7e-12.)
    expect(compareGeometry(small, smallText).sameOtherwise).toBe(true);
    const moved = { ...small, projection: { ...small.projection, cx: small.projection.cx + 0.5 } };
    expect(compareGeometry(moved, smallText).sameOtherwise).toBe(false);
    expect(compareGeometry({ ...small, name: 'Teneriffa' }, smallText).sameOtherwise).toBe(false);
  });

  it('compares the committed bytes: a reordered key or an extra one is noticed', () => {
    const { name, ...withoutName } = small;
    expect(compareGeometry(small, JSON.stringify({ ...withoutName, name })).sameOtherwise).toBe(false);
    expect(compareGeometry(small, JSON.stringify({ ...small, _note: 'edited by hand' })).sameOtherwise).toBe(false);
  });
});
