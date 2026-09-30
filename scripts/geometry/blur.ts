import { BLUR_REACH } from './config.js';

/* The coast smoothing. The reference set `ctx.filter = 'blur(σpx)'` on a
   canvas, which each browser implements its own way (box-blur approximations
   on the CPU, downscaling for large σ on the GPU) and then stores as 8-bit
   alpha, so it can't be reproduced exactly. This is the Gaussian the CSS
   filter stands for: σ in canvas pixels, which are grid cells here,
   truncated at ⌈3σ⌉ and normalised, applied along rows then columns. The
   grid is transparent outside, so the edges read zeros. */

/** A normalised Gaussian kernel of standard deviation σ, ⌈BLUR_REACH·σ⌉ taps each side of the centre; symmetric bit for bit. */
export function gaussianKernel(sigma: number): Float64Array {
  const r = Math.ceil(BLUR_REACH * sigma);
  const k = new Float64Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += k[i + r];
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

/**
 * A Gaussian blur of an n × n field (row-major), as a new field. Only the
 * box holding coverage, widened by the kernel's reach, is computed: every sum
 * outside it is a sum of zeros, so the result is the same bit for bit.
 */
export function blur(field: Float64Array, n: number, sigma: number): Float64Array {
  const k = gaussianKernel(sigma);
  const r = (k.length - 1) / 2;
  let top = n;
  let bottom = -1;
  let left = n;
  let right = -1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (field[y * n + x] !== 0) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
  const out = new Float64Array(n * n);
  if (bottom < 0) return out;
  const x0 = Math.max(0, left - r);
  const x1 = Math.min(n - 1, right + r);

  const rows = new Float64Array(n * n);
  for (let y = top; y <= bottom; y++) {
    const row = y * n;
    for (let x = x0; x <= x1; x++) {
      let s = 0;
      for (let i = Math.max(-r, -x), end = Math.min(r, n - 1 - x); i <= end; i++) s += field[row + x + i] * k[i + r];
      rows[row + x] = s;
    }
  }
  for (let y = Math.max(0, top - r), y1 = Math.min(n - 1, bottom + r); y <= y1; y++) {
    const from = Math.max(-r, -y);
    const to = Math.min(r, n - 1 - y);
    for (let x = x0; x <= x1; x++) {
      let s = 0;
      for (let i = from; i <= to; i++) s += rows[(y + i) * n + x] * k[i + r];
      out[y * n + x] = s;
    }
  }
  return out;
}
