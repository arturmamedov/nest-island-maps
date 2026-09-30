import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/shared/geo.js';
import { contour } from '../../../scripts/geometry/contour.js';
import { rasterise } from '../../../scripts/geometry/raster.js';

/* The coast fill replaces the canvas `fill()`: cell (i, j) covers
   [i, i+1] × [j, j+1] like a canvas pixel, and holds the fraction of it the
   polygon covers (nonzero rule), sampled on sub-scanlines in y and exact in x. */

const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

describe('rasterise', () => {
  it('fills a unit square into exactly its own cell', () => {
    const F = rasterise(square(3, 5, 4, 6), 8, 16);
    expect(F[5 * 8 + 3]).toBe(1);
    expect(F.reduce((sum, v) => sum + v, 0)).toBe(1);
  });

  it('shares a square that straddles cell edges between the four cells, a quarter each', () => {
    const F = rasterise(square(2.5, 2.5, 3.5, 3.5), 8, 16);
    for (const i of [2 * 8 + 2, 2 * 8 + 3, 3 * 8 + 2, 3 * 8 + 3]) expect(F[i]).toBe(0.25);
    expect(F.reduce((sum, v) => sum + v, 0)).toBe(1);
  });

  it('gives the same field for either winding', () => {
    const cw = [
      { x: 1.3, y: 1.1 },
      { x: 6.7, y: 2.2 },
      { x: 4.1, y: 6.9 },
    ];
    expect(Array.from(rasterise([...cw].reverse(), 8, 16))).toEqual(Array.from(rasterise(cw, 8, 16)));
  });

  it("conserves a triangle's area", () => {
    const F = rasterise(
      [
        { x: 1, y: 1 },
        { x: 9, y: 1 },
        { x: 1, y: 9 },
      ],
      12,
      16,
    );
    expect(Math.abs(F.reduce((sum, v) => sum + v, 0) - 32)).toBeLessThan(1e-9);
  });

  it('centres cells on i + ½, while contour reads index i as coordinate i: the half-cell shift', () => {
    // The reference's convention, kept on purpose: every committed path sits ≈ −0.4 artboard px off its raw coast.
    const line = contour(rasterise(square(10, 10, 20, 20), 32, 16), 32, 0.5);
    const xs = line.map((p) => p.x);
    const ys = line.map((p) => p.y);
    expect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]).toEqual([9.5, 9.5, 19.5, 19.5]);
  });
});
