import { describe, expect, it } from 'vitest';
import { dp, dpOpen } from '../../../scripts/geometry/simplify.js';

/* Douglas–Peucker exactly as tools/build-island.js ran it: the distance is to
   the infinite line through a run's ends, the first maximum wins, and a point
   survives only when it lies strictly farther than the tolerance. */

const P = (x: number, y: number) => ({ x, y });

describe('dpOpen', () => {
  it('drops collinear points', () => {
    expect(dpOpen([P(0, 0), P(1, 0), P(2, 0), P(3, 0)], 0.1)).toEqual([P(0, 0), P(3, 0)]);
  });

  it('keeps a point only when it lies farther than the tolerance', () => {
    expect(dpOpen([P(0, 0), P(1, 0.5), P(2, 0)], 0.5)).toEqual([P(0, 0), P(2, 0)]); // exactly 0.5: dropped
    expect(dpOpen([P(0, 0), P(1, 0.5), P(2, 0)], 0.4999)).toEqual([P(0, 0), P(1, 0.5), P(2, 0)]);
  });

  it('measures to the infinite line through the ends, not the segment', () => {
    expect(dpOpen([P(0, 0), P(5, 0), P(3, 0)], 0.1)).toEqual([P(0, 0), P(3, 0)]);
  });
});

describe('dp (a closed ring whose last point repeats its first)', () => {
  it('splits at the point farthest from the start and drops the closing duplicate', () => {
    const ring = [P(0, 0), P(5, 0), P(10, 0), P(10, 5), P(10, 10), P(5, 10), P(0, 10), P(0, 5), P(0, 0)];
    expect(dp(ring, 0.1)).toEqual([P(0, 0), P(10, 0), P(10, 10), P(0, 10)]);
  });

  it('keeps the split point even within the tolerance', () => {
    // One dpOpen over the whole ring would keep nothing but [P(0,0), P(0,0)].
    expect(dp([P(0, 0), P(0.5, 0), P(0.5, 0.5), P(0, 0.5), P(0, 0)], 1)).toEqual([P(0, 0), P(0.5, 0.5)]);
  });
});
