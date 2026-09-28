import { describe, expect, it } from 'vitest';
import { dataFileName, mapFileName } from '../../src/shared/filename.js';
import { ISLAND_IDS, LAYERS } from '../../src/shared/ids.js';

/* Spec §4 names the downloads; the web SVG gets its own suffix so the two SVG
   files never collide in the Downloads folder (docs/decisions.md, Export). */

describe('export file names', () => {
  for (const island of ISLAND_IDS) {
    for (const layer of LAYERS) {
      it(`${island} ${layer}`, () => {
        expect(mapFileName(island, layer, 'svg')).toBe(`${island}-${layer}.svg`);
        expect(mapFileName(island, layer, 'webSvg')).toBe(`${island}-${layer}-web.svg`);
        expect(mapFileName(island, layer, 'png')).toBe(`${island}-${layer}.png`);
        expect(mapFileName(island, layer, 'jpg')).toBe(`${island}-${layer}.jpg`);
      });
    }

    it(`${island} data file`, () => {
      expect(dataFileName(island)).toBe(`${island}-map-data.json`);
    });
  }

  it('matches the spec for Gran Canaria (the island id, underscore included)', () => {
    expect(mapFileName('gran_canaria', 'attractions', 'png')).toBe('gran_canaria-attractions.png');
    expect(dataFileName('gran_canaria')).toBe('gran_canaria-map-data.json');
  });
});
