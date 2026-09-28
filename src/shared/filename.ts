import type { IslandId, Layer } from './schema.js';

/* Download names (handoff README §4). The two SVGs differ by a suffix, so a
   Figma file and a web file of the same map never overwrite each other or
   turn into "name (1).svg". Type-only imports keep this module JSON-free at
   run time, so the Playwright specs can import it. */

export const MAP_FILE_SUFFIX = { svg: '.svg', webSvg: '-web.svg', png: '.png', jpg: '.jpg' } as const;
export type MapFormat = keyof typeof MAP_FILE_SUFFIX;

/** `<island>-<hostels|attractions>.<ext>`, with `-web.svg` for the font-embedded SVG. */
export function mapFileName(island: IslandId, layer: Layer, format: MapFormat): string {
  return `${island}-${layer}${MAP_FILE_SUFFIX[format]}`;
}

/** `<island>-map-data.json`: the Download JSON file, the same bytes as the seed. */
export function dataFileName(island: IslandId): string {
  return `${island}-map-data.json`;
}
