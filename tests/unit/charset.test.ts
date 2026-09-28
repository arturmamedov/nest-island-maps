import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LABEL_CHARSET } from '../../src/shared/tokens.js';

/* LABEL_CHARSET must stay inside what the self-hosted label fonts can draw
   (their latin + latin-ext subsets), or the PNG shows a fallback glyph. */

const ROOT = join(import.meta.dirname, '..', '..');
const FONT_PACKAGES = ['roboto-condensed', 'poppins', 'montserrat', 'archivo-black'];

function ranges(spec: string): [number, number][] {
  return spec.split(',').map((part) => {
    const [a, b] = part.replace('U+', '').split('-');
    return [parseInt(a!, 16), parseInt(b ?? a!, 16)];
  });
}

const allowed: number[] = [];
for (let cp = 0; cp <= 0xffff; cp++) {
  if (LABEL_CHARSET.test(String.fromCodePoint(cp))) allowed.push(cp);
}

describe('label charset', () => {
  it('is not empty and covers the accents in the data', () => {
    expect(allowed.length).toBeGreaterThan(400);
    expect(LABEL_CHARSET.test('Médano Güigüí Es Vedrà Benirràs Gáldar')).toBe(true);
  });

  for (const pkg of FONT_PACKAGES) {
    it(`is covered by @fontsource/${pkg} latin + latin-ext`, () => {
      const unicode = JSON.parse(readFileSync(join(ROOT, 'node_modules/@fontsource', pkg, 'unicode.json'), 'utf8'));
      const covered = [...ranges(unicode.latin), ...ranges(unicode['latin-ext'])];
      const missing = allowed.filter((cp) => !covered.some(([a, b]) => cp >= a && cp <= b));
      expect(missing.map((cp) => cp.toString(16))).toEqual([]);
    });
  }

  it('stays closed under toUpperCase (labels are uppercased at render)', () => {
    const escapes = allowed.filter((cp) => !LABEL_CHARSET.test(String.fromCodePoint(cp).toUpperCase()));
    expect(escapes.map((cp) => cp.toString(16))).toEqual([]);
  });

  it('refuses combining marks, CJK and emoji', () => {
    expect(LABEL_CHARSET.test('Médano')).toBe(false);
    expect(LABEL_CHARSET.test('東京')).toBe(false);
    expect(LABEL_CHARSET.test('Beach 🏖')).toBe(false);
  });
});
