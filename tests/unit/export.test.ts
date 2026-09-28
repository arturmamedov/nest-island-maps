import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataFileBlob } from '../../src/export/json.js';
import { renderMapSvg, renderWebSvg } from '../../src/export/svg.js';
import { createFontEmbedder, type FetchFontBytes } from '../../src/map/embedFonts.js';
import { ISLANDS } from '../../src/shared/islands.js';
import { ISLAND_IDS } from '../../src/shared/schema.js';
import { ATTRIBUTION, LABEL_FONTS, LABEL_FONT_IDS, type LabelFontId } from '../../src/shared/tokens.js';
import { stubMeasurer } from './stubMeasurer.js';

/* The export files, in Node. The web SVG must be the Figma SVG plus one
   <style> of embedded faces; the font bytes sit behind an injected fetch, so
   the stub hands back each file's own name and the test can read which woff2
   went into which @font-face rule. Download JSON must be the seed's bytes. */

const ROOT = join(import.meta.dirname, '..', '..');
const SUBSETS = ['latin', 'latin-ext'] as const;

const fileOf = (url: string) => basename(url.split('?')[0]!);
const slug = (family: string) => family.toLowerCase().replace(/ /g, '-');
const unicodeOf = (family: string): Record<string, string> =>
  JSON.parse(readFileSync(join(ROOT, 'node_modules/@fontsource', slug(family), 'unicode.json'), 'utf8'));

/** A fetch whose "font bytes" are the requested file's name, and a log of the calls. */
function stubFetch() {
  const calls: string[] = [];
  const fetchBytes: FetchFontBytes = async (url) => {
    calls.push(fileOf(url));
    return new TextEncoder().encode(fileOf(url)).buffer;
  };
  return { calls, fetchBytes };
}

const RULE =
  /@font-face\{font-family:"([^"]+)";font-style:normal;font-weight:(\d+);src:url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\) format\("woff2"\);unicode-range:([^}]+)\}/g;

const propsFor = (labelFont: LabelFontId) => {
  const { geometry, seed } = ISLANDS.tenerife;
  return { geometry, data: { ...seed, settings: { ...seed.settings, labelFont } }, layer: 'hostels' as const, measure: stubMeasurer };
};

describe.each(LABEL_FONT_IDS)('web SVG with %s labels', (labelFont) => {
  it('is the Figma SVG plus one <style>, as the first child of <svg>', async () => {
    const props = propsFor(labelFont);
    const figma = renderMapSvg(props);
    const web = await renderWebSvg(props, createFontEmbedder(stubFetch().fetchBytes));

    const styles = web.match(/<style>[^<]*<\/style>\n/g) ?? [];
    expect(styles).toHaveLength(1);
    expect(web.replace(styles[0]!, '')).toBe(figma);
    const svgOpen = figma.slice(0, figma.indexOf('>\n', figma.indexOf('<svg')) + 2);
    expect(web.startsWith(svgOpen + '<style>')).toBe(true);
  });

  it('embeds the label face and Montserrat 400, latin and latin-ext only', async () => {
    const web = await renderWebSvg(propsFor(labelFont), createFontEmbedder(stubFetch().fetchBytes));
    const css = /<style>([^<]*)<\/style>/.exec(web)![1]!;

    // Nothing in the <style> but the @font-face rules.
    expect(css.replace(RULE, '')).toBe('');
    const rules = [...css.matchAll(RULE)].map(([, family, weight, b64, range]) => ({ family, weight: Number(weight), file: atob(b64!), range }));

    const faces = [LABEL_FONTS[labelFont], { family: ATTRIBUTION.family, weight: ATTRIBUTION.weight }];
    const expected = faces.flatMap(({ family, weight }) =>
      SUBSETS.map((subset) => ({ family, weight, file: `${slug(family)}-${subset}-${weight}-normal.woff2`, range: unicodeOf(family)[subset] })),
    );
    expect(rules).toEqual(expected);
  });
});

describe('font embedder', () => {
  it('fetches each face once per session', async () => {
    const { calls, fetchBytes } = stubFetch();
    const fonts = createFontEmbedder(fetchBytes);
    await fonts.css('robotoCondensed');
    await fonts.css('robotoCondensed');
    await fonts.css('poppins');
    expect([...calls].sort()).toEqual(
      [
        'roboto-condensed-latin-700-normal.woff2',
        'roboto-condensed-latin-ext-700-normal.woff2',
        'montserrat-latin-400-normal.woff2',
        'montserrat-latin-ext-400-normal.woff2',
        'poppins-latin-600-normal.woff2',
        'poppins-latin-ext-600-normal.woff2',
      ].sort(),
    );
  });

  it('forgets a failed fetch, so the next export retries', async () => {
    let fail = true;
    const { fetchBytes } = stubFetch();
    const fonts = createFontEmbedder(async (url) => {
      if (fail) throw new Error('offline');
      return fetchBytes(url);
    });
    await expect(fonts.css('robotoCondensed')).rejects.toThrow('offline');
    fail = false;
    await expect(fonts.css('robotoCondensed')).resolves.toMatch(/^@font-face/);
  });
});

describe('Download JSON', () => {
  for (const id of ISLAND_IDS) {
    it(`${id}: the file is the seed's bytes`, async () => {
      const { seed, geometry } = ISLANDS[id];
      const blob = dataFileBlob(seed, geometry);
      expect(blob.type).toBe('application/json');
      const bytes = Buffer.from(await blob.arrayBuffer());
      const file = readFileSync(join(ROOT, 'data/seed', `${id}.json`));
      expect(bytes.toString('utf8')).toBe(file.toString('utf8'));
      expect(bytes.equals(file)).toBe(true);
    });
  }
});
