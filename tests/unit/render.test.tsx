import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderMapSvg } from '../../src/export/svg.js';
import { IslandMap, type IslandMapProps } from '../../src/map/IslandMap.js';
import { ISLANDS } from '../../src/shared/islands.js';
import { ISLAND_IDS, LAYERS, type IslandId, type Layer, type Settings } from '../../src/shared/schema.js';
import { ATTRIBUTION, NEST_PASS } from '../../src/shared/tokens.js';
import { stubMeasurer } from './stubMeasurer.js';

/* The SVG is the product: file snapshots of every map (plus the settings
   variants) keep its markup reviewable in diffs, and the guards below hold
   the house rules over every one of them. renderMapSvg is also the "SVG for
   Figma" download, so these guards are that file's tests. A pure stub
   measurer stands in for canvas measureText, so the snapshots don't depend
   on installed fonts. */

type Case = { name: string; island: IslandId; layer: Layer; settings?: Partial<Settings> };
const CASES: Case[] = [
  ...ISLAND_IDS.flatMap((island) => LAYERS.map((layer) => ({ name: `${island}-${layer}`, island, layer }))),
  { name: 'tenerife-hostels-dot', island: 'tenerife', layer: 'hostels', settings: { pinStyle: 'dot' } },
  { name: 'tenerife-hostels-text', island: 'tenerife', layer: 'hostels', settings: { labelStyle: 'text' } },
  { name: 'gran_canaria-hostels-brand-teal', island: 'gran_canaria', layer: 'hostels', settings: { palette: 'brandTeal' } },
  { name: 'ibiza-hostels-rings-2', island: 'ibiza', layer: 'hostels', settings: { rings: 2 } },
  // Montserrat is one of the wide faces: the taller, squarer pill.
  { name: 'tenerife-hostels-montserrat', island: 'tenerife', layer: 'hostels', settings: { labelFont: 'montserrat' } },
];

const propsOf = (c: Case): IslandMapProps => {
  const { geometry, seed } = ISLANDS[c.island];
  return { geometry, data: { ...seed, settings: { ...seed.settings, ...c.settings } }, layer: c.layer, measure: stubMeasurer };
};

const noop = () => {};

describe.each(CASES)('$name', (c) => {
  const props = propsOf(c);
  const svg = renderMapSvg(props);
  const items = c.layer === 'hostels' ? props.data.hostels : props.data.attractions;

  it('matches its file snapshot', async () => {
    await expect(svg).toMatchFileSnapshot(`./__snapshots__/${c.name}.svg`);
  });

  it('is a standalone 1080 × 1080 SVG file', () => {
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">\n')).toBe(true);
    expect(svg.endsWith('</svg>\n')).toBe(true);
  });

  it('never uses the Book Now orange', () => {
    expect(svg).not.toMatch(/#EA580C/i);
  });

  if (c.island === 'ibiza') {
    it('carries no Nest Pass content', () => {
      expect(svg).not.toMatch(NEST_PASS);
    });
  }

  it('has every layer id, in order, and the attribution', () => {
    const at = ['halo-rings', 'island', 'decor', c.layer, 'attribution'].map((id) => svg.indexOf(` id="${id}"`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(svg).toContain(`>${ATTRIBUTION.text}</text>`);
  });

  it('prefixes the defs ids with the island and layer', () => {
    for (const def of ['halo', 'land', 'shadow']) expect(svg).toContain(` id="${c.island}-${c.layer}-${def}"`);
  });

  it('writes every visible label in capitals', () => {
    // React never self-closes: an empty element is <rect …></rect>.
    const texts = [...svg.matchAll(/<g id="label-[^"]+"[^>]*>\n(?:<rect[^>]*>\n<\/rect>\n)?<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(texts).toEqual(items.filter((i) => i.visible).map((i) => i.label.toUpperCase()));
    for (const t of texts) expect(t).toBe(t!.toUpperCase());
  });

  it('uses presentation attributes and inline paths only', () => {
    expect(svg).not.toContain('style=');
    expect(svg).not.toMatch(/<(use|symbol)\b/);
  });

  it('carries no editor markup', () => {
    expect(svg).not.toContain('data-hit');
    expect(svg).not.toContain('cursor');
  });

  it('embeds no fonts (Figma and Illustrator use the installed faces)', () => {
    expect(svg).not.toContain('<style');
  });

  it('edit mode adds only hit rects and cursors', () => {
    const exported = renderToStaticMarkup(<IslandMap {...props} />);
    const edit = renderToStaticMarkup(<IslandMap {...props} interaction={{ onLabelPointerDown: noop, onDecorPointerDown: noop }} />);
    const hit = /<rect data-hit[^>]*><\/rect>/g;
    expect(edit.match(hit) ?? []).toHaveLength(items.filter((i) => i.visible).length + (edit.match(/<g id="decor-/g) ?? []).length);
    expect(edit).toMatch(/style="cursor:/);
    expect(edit.replace(hit, '').replace(/ style="cursor:[^"]*"/g, '')).toBe(exported);
  });
});

describe('purity', () => {
  it('renders the same markup twice', () => {
    const props = propsOf(CASES[0]!);
    expect(renderMapSvg(props)).toBe(renderMapSvg(props));
  });
});
