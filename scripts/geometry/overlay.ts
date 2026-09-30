import { ARTBOARD } from '../../src/shared/tokens.js';

/* A picture to judge a rebuild by eye, as tools/build-island.js drew one: the
   rebuilt coast (red) and rings (blue), 1.5 px, over the original website map
   at half opacity, or over the committed paths (grey) where there is no map
   (Ibiza). An SVG rather than a PNG, so it needs no rasteriser and zooms
   cleanly. The reference also plotted test points; the editor's "In the sea"
   badge does that job now. */

const COAST = '#e0245e';
const RING = '#1a56db';
const COMMITTED = '#9ca3af';

/** What the rebuilt paths are drawn over: a reference image (a data URL) or the committed paths. */
export type OverlayUnder = { image: string } | { paths: readonly string[] };

const stroke = (d: string, color: string) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`;

/** The overlay SVG for one island's rebuilt coast and rings. */
export function overlaySvg({ coast, rings, under }: { coast: string; rings: readonly string[]; under: OverlayUnder }): string {
  const size = `width="${ARTBOARD}" height="${ARTBOARD}"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${ARTBOARD} ${ARTBOARD}">`,
    `<rect ${size} fill="#ffffff"/>`,
    'image' in under ? `<image href="${under.image}" ${size} opacity="0.5"/>` : under.paths.map((d) => stroke(d, COMMITTED)).join('\n'),
    ...rings.map((d) => stroke(d, RING)),
    stroke(coast, COAST),
    '</svg>',
  ].join('\n');
}
