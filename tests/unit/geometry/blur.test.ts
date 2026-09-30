import { describe, expect, it } from 'vitest';
import { blur, gaussianKernel } from '../../../scripts/geometry/blur.js';

/* The coast blur replaces the browser's `ctx.filter = 'blur(σpx)'`, which no
   engine specifies exactly: a normalised, truncated Gaussian with σ in grid
   cells, applied along rows then columns, with nothing outside the grid. */

describe('gaussianKernel', () => {
  for (const sigma of [2.2, 4.2]) {
    it(`σ ${sigma}: reaches ⌈3σ⌉ cells each side, sums to 1, is symmetric and peaks at the centre`, () => {
      const k = gaussianKernel(sigma);
      const r = Math.ceil(3 * sigma);
      expect(k).toHaveLength(2 * r + 1);
      expect(k.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 12);
      for (let i = 0; i < k.length; i++) expect(k[i]).toBe(k[k.length - 1 - i]);
      expect(Math.max(...k)).toBe(k[r]);
    });
  }
});

describe('blur', () => {
  it('spreads an impulse into the outer product of the kernel (it is separable)', () => {
    const n = 41;
    const F = new Float64Array(n * n);
    F[20 * n + 20] = 1;
    const out = blur(F, n, 2.2);
    const k = gaussianKernel(2.2);
    const r = (k.length - 1) / 2;
    const w = (i: number) => (Math.abs(i - 20) <= r ? k[i - 20 + r]! : 0);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) expect(Math.abs(out[y * n + x]! - w(y) * w(x))).toBeLessThan(1e-15);
  });

  it('keeps the 50 % crossing of a straight edge on the edge', () => {
    // Cells 0–9 full, 10 onward empty: the blurred samples 9 and 10 sum to 1, so 0.5 interpolates to 9.5.
    const n = 40;
    const out = blur(
      Float64Array.from({ length: n * n }, (_, i) => (i % n <= 9 ? 1 : 0)),
      n,
      2.2,
    );
    expect(out[20 * n + 9]! + out[20 * n + 10]!).toBeCloseTo(1, 12);
    expect(out[20 * n + 9]!).toBeGreaterThan(0.5);
  });
});
