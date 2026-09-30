import { describe, expect, it } from 'vitest';
import { toD } from '../../../scripts/geometry/path.js';

/* The committed paths are one M, L…, Z with exactly one decimal per number
   (`828.0` keeps its zero) and no repeated closing vertex. */

describe('toD', () => {
  it('writes one decimal, keeps a trailing zero and closes with Z', () => {
    expect(
      toD([
        { x: 828, y: 272.8 },
        { x: 811.23, y: 272.06 },
        { x: 5, y: 7.44 },
      ]),
    ).toBe('M828.0 272.8L811.2 272.1L5.0 7.4Z');
  });

  it('matches the committed path format', () => {
    expect(
      toD([
        { x: 1, y: 2 },
        { x: 3.14159, y: 4 },
        { x: 5, y: 6 },
      ]),
    ).toMatch(/^M\d+\.\d \d+\.\d(L\d+\.\d \d+\.\d)+Z$/);
  });
});
