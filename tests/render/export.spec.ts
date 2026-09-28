import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
// JSON-free modules only: Playwright's ESM loader refuses schema.ts's JSON imports.
import { dataFileName, mapFileName } from '../../src/shared/filename.js';
import { ISLAND_IDS, LAYER_LABELS, LAYERS } from '../../src/shared/ids.js';
import { ARTBOARD, ATTRIBUTION, EXPORT_SCALE, LABEL_FONTS } from '../../src/shared/tokens.js';

/* The exports as staff get them: buttons clicked in the built editor, files
   captured from the download. The fidelity check (plan decision 11, spec §6
   step 4) holds the PNG, rendered through <img> and canvas with embedded
   fonts, to Chromium's own screenshot of the same map at DPR 2. Both buffers
   are live, so nothing is committed. */

const ROOT = join(import.meta.dirname, '..', '..');
const SIZE = ARTBOARD * EXPORT_SCALE;
const MAX_DIFF_RATIO = 0.005;

type IslandId = (typeof ISLAND_IDS)[number];
type Layer = (typeof LAYERS)[number];

const islandName = (id: IslandId): string => JSON.parse(readFileSync(join(ROOT, 'data/geometry', `${id}.geo.json`), 'utf8')).name;

async function selectMap(page: Page, island: IslandId, layer: Layer) {
  await page.getByRole('tablist', { name: 'Island' }).getByRole('tab', { name: islandName(island), exact: true }).click();
  await page.getByRole('tablist', { name: 'Map' }).getByRole('tab', { name: new RegExp(`^${LAYER_LABELS[layer]} · `) }).click();
}

/** Clicks an export button and returns the downloaded file. */
async function download(page: Page, button: string) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button, exact: true }).click()]);
  return { name: file.suggestedFilename(), bytes: readFileSync(await file.path()) };
}

/** Chromium's own rendering of the map: the bare render page at DPR 2, transparent. */
async function screenshotAt2x(browser: Browser, baseURL: string, island: IslandId, layer: Layer) {
  const context = await browser.newContext({ baseURL, viewport: { width: ARTBOARD, height: ARTBOARD }, deviceScaleFactor: EXPORT_SCALE });
  try {
    const page = await context.newPage();
    await page.goto(`/render.html?island=${island}&layer=${layer}`);
    await page.waitForFunction(() => window.__MAP_READY === true || window.__MAP_ERROR !== undefined);
    expect(await page.evaluate(() => window.__MAP_ERROR)).toBeUndefined();
    return PNG.sync.read(await page.locator('svg').screenshot({ omitBackground: true }));
  } finally {
    await context.close();
  }
}

const diffRatio = (a: PNG, b: PNG) => pixelmatch(a.data, b.data, undefined, SIZE, SIZE, { threshold: 0.1 }) / (SIZE * SIZE);

/** Draws an SVG string as raster.ts does (Blob URL → <img> → canvas at 2160), for SVGs the test has altered. */
async function rasteriseInPage(page: Page, svg: string) {
  const b64 = await page.evaluate(
    async ([text, size]) => {
      const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d')!.drawImage(img, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1]!;
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [svg, SIZE] as const,
  );
  return PNG.sync.read(Buffer.from(b64, 'base64'));
}

/* Renames every map family to one no machine has installed, in the @font-face
   rules and the text alike, so only the embedded bytes can draw the labels.
   The names are letters only: font-family is unquoted in the SVG, and a word
   starting with a digit would void the whole declaration. */
function aliasFamilies(svg: string): string {
  const families = [...new Set([...Object.values(LABEL_FONTS).map((f) => f.family), ATTRIBUTION.family])];
  return families.reduce((text, family, i) => text.replaceAll(family, `Nest Island Maps Embedded ${String.fromCharCode(65 + i)}`), svg);
}

const corners = (w: number, h: number) => [
  [0, 0],
  [w - 1, 0],
  [0, h - 1],
  [w - 1, h - 1],
];

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

for (const island of ISLAND_IDS) {
  for (const layer of LAYERS) {
    test(`PNG fidelity: ${island} ${layer}`, async ({ page, browser, baseURL }) => {
      await selectMap(page, island, layer);
      const file = await download(page, 'PNG');
      expect(file.name).toBe(mapFileName(island, layer, 'png'));
      const exported = PNG.sync.read(file.bytes);
      const reference = await screenshotAt2x(browser, baseURL!, island, layer);

      expect([exported.width, exported.height]).toEqual([SIZE, SIZE]);
      expect([reference.width, reference.height]).toEqual([SIZE, SIZE]);
      const differing = pixelmatch(exported.data, reference.data, undefined, SIZE, SIZE, { threshold: 0.1 });
      const ratio = differing / (SIZE * SIZE);
      console.log(`${island} ${layer}: ${differing} differing pixels (${(ratio * 100).toFixed(3)} %)`);
      expect(ratio).toBeLessThan(MAX_DIFF_RATIO);
    });
  }
}

/* The fidelity check alone cannot prove the embedding: an SVG in an <img>
   may use fonts installed on the machine, and staff (like the owner) often
   have the brand faces installed. With the families renamed, the web SVG
   must still match Chromium's own rendering, near enough pixel for pixel
   (same bytes, same engine); without its <style> the labels fall back and
   thousands of pixels change, which shows the renaming really shuts the
   installed faces out. */
test('the web SVG draws with its embedded faces, whatever the machine has installed', async ({ page, browser, baseURL }) => {
  const reference = await screenshotAt2x(browser, baseURL!, 'tenerife', 'hostels');
  const web = aliasFamilies((await download(page, 'SVG for web')).bytes.toString('utf8'));
  const embedded = diffRatio(await rasteriseInPage(page, web), reference);
  const bare = diffRatio(await rasteriseInPage(page, web.replace(/<style>[^<]*<\/style>\n/, '')), reference);
  console.log(`renamed families: ${(embedded * 100).toFixed(3)} % with the embedded faces, ${(bare * 100).toFixed(3)} % without`);
  expect(embedded).toBeLessThan(0.0005);
  expect(bare).toBeGreaterThan(0.002);
});

test('PNG is 2160 × 2160 with transparent corners', async ({ page }) => {
  const file = await download(page, 'PNG');
  await expect(page.getByRole('status')).toHaveText('PNG downloaded');
  const png = PNG.sync.read(file.bytes);
  expect([png.width, png.height]).toEqual([SIZE, SIZE]);
  for (const [x, y] of corners(png.width, png.height)) expect(png.data[(y! * png.width + x!) * 4 + 3], `alpha at ${x},${y}`).toBe(0);
});

test('JPG is 2160 × 2160 on white', async ({ page }) => {
  const file = await download(page, 'JPG');
  expect(file.name).toBe(mapFileName('tenerife', 'hostels', 'jpg'));
  expect([...file.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);

  // Decoded by the browser, so the test needs no JPEG library.
  const jpg = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    const w = bitmap.width;
    const h = bitmap.height;
    return { width: w, height: h, corners: [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)] };
  }, file.bytes.toString('base64'));

  expect([jpg.width, jpg.height]).toEqual([SIZE, SIZE]);
  for (const [r, g, b, a] of jpg.corners) {
    expect(Math.min(r!, g!, b!)).toBeGreaterThanOrEqual(250);
    expect(a).toBe(255);
  }
});

test('the two SVGs: Figma without fonts, web with its faces embedded', async ({ page }) => {
  const figma = await download(page, 'SVG (Figma)');
  const web = await download(page, 'SVG for web');
  expect(figma.name).toBe(mapFileName('tenerife', 'hostels', 'svg'));
  expect(web.name).toBe(mapFileName('tenerife', 'hostels', 'webSvg'));

  const figmaText = figma.bytes.toString('utf8');
  const webText = web.bytes.toString('utf8');
  expect(figmaText.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  expect(figmaText).not.toContain('<style');
  expect(figmaText).not.toContain('data-hit');
  expect(webText.match(/@font-face\{/g)).toHaveLength(4);
  expect(webText.replace(/<style>[^<]*<\/style>\n/, '')).toBe(figmaText);
});

test('Copy SVG puts the Figma SVG on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const figma = (await download(page, 'SVG (Figma)')).bytes.toString('utf8');
  await page.getByRole('button', { name: 'Copy SVG', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('SVG copied — paste into Figma or code');
  // Chromium on Windows writes clipboard text with CRLF line ends; the markup is otherwise the same.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(figma);
});

test('Download JSON is the seed file, byte for byte, for every island', async ({ page }) => {
  for (const island of ISLAND_IDS) {
    await selectMap(page, island, 'hostels');
    const file = await download(page, 'Download JSON');
    expect(file.name).toBe(dataFileName(island));
    expect(file.bytes.toString('utf8')).toBe(readFileSync(join(ROOT, 'data/seed', `${island}.json`), 'utf8'));
    expect(file.bytes.equals(readFileSync(join(ROOT, 'data/seed', `${island}.json`)))).toBe(true);
  }
});
