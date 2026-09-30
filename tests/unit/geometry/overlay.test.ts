import { describe, expect, it } from 'vitest';
import { overlaySvg } from '../../../scripts/geometry/overlay.js';

/* The overlay is for looking: the rebuilt coast and rings drawn over the
   original map (Tenerife, Gran Canaria) or over the committed paths (Ibiza,
   which never had a map). */

const coast = 'M1.0 1.0L9.0 1.0L9.0 9.0Z';
const rings = ['M0.0 0.0L10.0 0.0L10.0 10.0Z', 'M0.0 0.0L11.0 0.0L11.0 11.0Z', 'M0.0 0.0L12.0 0.0L12.0 12.0Z', 'M0.0 0.0L13.0 0.0L13.0 13.0Z'];

describe('overlaySvg', () => {
  it('draws the rebuilt paths over a half-transparent reference image, or over the committed paths', () => {
    const overImage = overlaySvg({ coast, rings, under: { image: 'data:image/png;base64,AAAA' } });
    expect(overImage).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1080" height="1080" viewBox="0 0 1080 1080">/);
    expect(overImage).toMatch(/<image href="data:image\/png;base64,AAAA"[^>]* opacity="0\.5"/);

    const committed = 'M2.0 2.0L8.0 2.0L8.0 8.0Z';
    const overPaths = overlaySvg({ coast, rings, under: { paths: [committed] } });
    expect(overPaths).not.toContain('<image');
    expect(overPaths.indexOf(`d="${committed}"`)).toBeGreaterThan(-1);
    expect(overPaths.indexOf(`d="${committed}"`)).toBeLessThan(overPaths.indexOf(`d="${coast}"`));
    for (const d of rings) expect(overPaths).toContain(`d="${d}"`);
  });
});
