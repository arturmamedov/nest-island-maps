import { describe, expect, it } from 'vitest';
import { pointInPolygons } from '../../../src/shared/geo.js';
import { contour } from '../../../scripts/geometry/contour.js';
import { shoelace } from './helpers.js';

/* Marching squares as tools/build-island.js traced the coast and the rings:
   samples sit at integer indices, a corner exactly on the level counts as
   inside, the saddles are fixed, and only the longest stitched line is kept.
   Coordinates come back in grid cells. */

/** An n × n field from a function of the sample's (x, y) index. */
const field = (n: number, f: (x: number, y: number) => number) => Float64Array.from({ length: n * n }, (_, i) => f(i % n, Math.floor(i / n)));

describe('contour', () => {
  it('traces a disc at its radius, closed, clockwise on screen, starting at the top', () => {
    const [cx, cy, r] = [16.3, 16.2, 9.7]; // off the lattice, so no sample sits exactly on the level
    const line = contour(
      field(32, (x, y) => r - Math.hypot(x - cx, y - cy)),
      32,
      0,
    );
    expect(line.length).toBeGreaterThan(40);
    for (const p of line) expect(Math.abs(Math.hypot(p.x - cx, p.y - cy) - r)).toBeLessThan(0.05);
    expect(line.at(-1)).toEqual(line[0]);
    expect(shoelace(line)).toBeGreaterThan(0);
    expect(line[0]!.y - Math.min(...line.map((p) => p.y))).toBeLessThan(1);
  });

  it('reads sample index i as coordinate i', () => {
    // A ramp F = x, traced at 2.5: an open line straight down the grid.
    const line = contour(
      field(6, (x) => x),
      6,
      2.5,
    );
    expect(line).toHaveLength(6);
    expect(line.every((p) => p.x === 2.5)).toBe(true);
  });

  it('reproduces the reference walk at exact ties (golden)', () => {
    // Twelve lattice points sit exactly on the level. The reference, measured
    // verbatim, walks 77 points counter-clockwise; `>` for `>=` gives 73, clockwise.
    const line = contour(
      field(41, (x, y) => -Math.hypot(x - 20, y - 20)),
      41,
      -10,
    );
    expect(line).toHaveLength(77);
    expect(line.slice(0, 3)).toEqual([
      { x: 20, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 10 },
    ]);
    expect(line[3]!.x).toBe(19);
    expect(line[3]!.y).toBeCloseTo(10.0502, 4);
    expect(line.at(-1)).toEqual(line[0]);
    expect(shoelace(line)).toBeLessThan(0);
  });

  it('joins the inside corners of both saddles', () => {
    // Case 10, (1,1) + (2,2), then case 5, (2,1) + (1,2): each pair ends up inside one line.
    for (const inside of [
      [6, 12],
      [7, 11],
    ]) {
      const F = new Float64Array(25);
      for (const i of inside) F[i] = 1;
      const line = contour(F, 5, 0.5);
      for (const i of inside) expect(pointInPolygons([line], i % 5, Math.floor(i / 5))).toBe(true);
    }
  });

  it('keeps only the longest line', () => {
    // A small disc comes first in row order; the big one has more points and wins.
    const disc = (x: number, y: number, cx: number, cy: number, r: number) => r - Math.hypot(x - cx, y - cy);
    const line = contour(
      field(40, (x, y) => Math.max(disc(x, y, 8.3, 8.2, 3), disc(x, y, 25.3, 25.2, 6))),
      40,
      0,
    );
    expect(pointInPolygons([line], 25, 25)).toBe(true);
    expect(pointInPolygons([line], 8, 8)).toBe(false);
  });

  it('counts a sample exactly on the level as inside', () => {
    // With `>` there would be no line at all; with `>=` four degenerate segments meet at the sample.
    const F = new Float64Array(9);
    F[4] = 0.5;
    const line = contour(F, 3, 0.5);
    expect(line).toHaveLength(5);
    expect(line.every((p) => p.x === 1 && p.y === 1)).toBe(true);
  });
});
