import { describe, expect, it } from 'vitest';
import { edt } from '../../../scripts/geometry/edt.js';

/* The exact Euclidean distance transform: every value is the square root of a
   whole number, so it must equal brute force bit for bit. The ring thresholds
   depend on that (ring 2 dilates to exactly 110 cells). */

const grid = (n: number, source: (x: number, y: number) => boolean) =>
  Uint8Array.from({ length: n * n }, (_, i) => (source(i % n, Math.floor(i / n)) ? 1 : 0));

function bruteForce(sources: Uint8Array, n: number): number[] {
  const at: [number, number][] = [];
  sources.forEach((s, i) => s && at.push([i % n, Math.floor(i / n)]));
  return Array.from({ length: n * n }, (_, i) => {
    const x = i % n;
    const y = Math.floor(i / n);
    let best = Infinity;
    for (const [sx, sy] of at) best = Math.min(best, (x - sx) ** 2 + (y - sy) ** 2);
    return Math.sqrt(best);
  });
}

describe('edt', () => {
  it('gives the distance to a single point everywhere', () => {
    const src = grid(9, (x, y) => x === 2 && y === 4);
    const d = edt(src, 9);
    expect(Array.from(d)).toEqual(bruteForce(src, 9));
    expect(d[0]).toBe(Math.sqrt(20));
  });

  it('is zero inside a filled square and exact outside it', () => {
    const src = grid(12, (x, y) => x >= 4 && x < 8 && y >= 4 && y < 8);
    const d = edt(src, 12);
    expect(Array.from(d)).toEqual(bruteForce(src, 12));
    expect(d[5 * 12 + 5]).toBe(0);
  });

  it('measures around an L-shape, to its outer corner and into its elbow', () => {
    const src = grid(12, (x, y) => (x >= 2 && x <= 3 && y >= 2 && y <= 9) || (x >= 2 && x <= 9 && y >= 8 && y <= 9));
    const d = edt(src, 12);
    expect(Array.from(d)).toEqual(bruteForce(src, 12));
    expect(d[0]).toBe(Math.sqrt(8)); // the outer corner (2, 2)
    expect(d[5 * 12 + 6]).toBe(3); // inside the elbow, 3 from the upright and 3 above the foot
  });

  it('matches brute force on a scatter of sources', () => {
    const src = grid(16, (x, y) => (x * 7 + y * 13) % 17 === 0);
    expect(Array.from(edt(src, 16))).toEqual(bruteForce(src, 16));
  });
});
