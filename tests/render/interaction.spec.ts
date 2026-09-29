import { expect, test, type Locator, type Page } from '@playwright/test';
import { project, unproject } from '../../src/shared/geo.js';
import { ARTBOARD } from '../../src/shared/tokens.js';
import { download, islandTab, projectionOf, seedText, tabOf } from './helpers.js';

/* Direct manipulation on the large map (M5, spec §2 "Interactions"), in the
   built app: drags, placing and the thumbnails, checked through what reaches
   Download JSON and the exported SVG, which don't depend on when the label
   fonts finish loading. Pointer positions come from the map's own box (the
   1080 px viewport stacks the layout), in whole client pixels. */

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number };
type Placement = { side: string; dx: number; dy: number };
type DataFile = {
  hostels: { slug: string; label: string; lat: number; lng: number; coordsVerified: boolean; labelPlacement: Placement }[];
  attractions: { id: string; label: string; icon: string; lat: number; lng: number; labelPlacement: Placement }[];
  decor: { id: string; lat: number; lng: number }[];
};

const row = (page: Page, key: string) => page.locator(`[data-key="${key}"]`);
const stageMap = (page: Page) => page.getByTestId('selected-map').locator('svg');
const caption = (page: Page) => page.getByTestId('selected-map').locator('figcaption');
const placeButton = (page: Page) => page.getByRole('button', { name: '⌖ Click map to place', exact: true });
const cancelButton = (page: Page) => page.getByRole('button', { name: 'Cancel placing', exact: true });
const banner = (page: Page) => page.locator('.placing-banner');
const thumbnail = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const dataFile = async (page: Page): Promise<DataFile> => JSON.parse((await download(page, 'Download JSON')).bytes.toString('utf8'));
const seed = (): DataFile => JSON.parse(seedText('tenerife'));
const tenerife = projectionOf('tenerife');

/** The large map's <svg> box, scrolled into view, once the fonts are in. */
async function mapBox(page: Page): Promise<Box> {
  await stageMap(page).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  return (await stageMap(page).boundingBox())!;
}

const scaleOf = (box: Box) => ARTBOARD / box.width;
/** Whole client pixels over the map for an artboard point. */
const clientAt = (box: Box, p: Point): Point => ({ x: Math.round(box.x + p.x / scaleOf(box)), y: Math.round(box.y + p.y / scaleOf(box)) });
/** The artboard point under whole client pixels. */
const artboardAt = (box: Box, c: Point): Point => ({ x: (c.x - box.x) * scaleOf(box), y: (c.y - box.y) * scaleOf(box) });

async function centreOf(locator: Locator): Promise<Point> {
  const b = (await locator.boundingBox())!;
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
}

/** Press at `from`, move by `by` in a few steps, release. */
async function drag(page: Page, from: Point, by: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 6 });
  await page.mouse.up();
}

/** A stored point that lands where the map was clicked: 5 decimals are far finer than a client pixel. */
function landsAt(item: { lat: number; lng: number }, at: Point) {
  const expected = unproject(tenerife, at.x, at.y);
  expect(item.lat).toBeCloseTo(expected.lat, 4);
  expect(item.lng).toBeCloseTo(expected.lng, 4);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

test('dragging a label moves its nudge in the SVG, and a reload keeps it', async ({ page }) => {
  const box = await mapBox(page);
  const label = stageMap(page).locator('#label-adeje-nest');
  const before = (await label.getAttribute('transform'))!;
  const by = { x: 40, y: -30 };
  await drag(page, await centreOf(label), by);

  const nudge = { side: 'right', dx: Math.round(by.x * scaleOf(box)), dy: Math.round(by.y * scaleOf(box)) };
  expect((await dataFile(page)).hostels.find((h) => h.slug === 'adeje-nest')!.labelPlacement).toEqual(nudge);
  await expect(label).not.toHaveAttribute('transform', before);
  const after = (await label.getAttribute('transform'))!;
  const svg = (await download(page, 'SVG (Figma)')).bytes.toString('utf8');
  expect(svg).toContain(`<g id="label-adeje-nest" transform="${after}">`);
  // Nudged past 6 px, it gains a leader: El Médano's three, plus this one.
  expect(svg.match(/<line /g)).toHaveLength(4);

  await page.reload();
  await expect(stageMap(page).locator('#label-adeje-nest')).toHaveAttribute('transform', after);
  expect((await dataFile(page)).hostels.find((h) => h.slug === 'adeje-nest')!.labelPlacement).toEqual(nudge);
});

test('a press that moves under 3 px is a click, not a drag', async ({ page }) => {
  await mapBox(page);
  for (const id of ['#label-adeje-nest', '#decor-sun']) {
    const from = await centreOf(stageMap(page).locator(id));
    await drag(page, from, { x: 2, y: 0 });
    await drag(page, from, { x: 2, y: 2 });
  }
  // A decor press that never became a drag leaves the tab alone.
  await expect(tabOf(page, 'hostels')).toHaveAttribute('aria-selected', 'true');
  expect((await download(page, 'Download JSON')).bytes.toString('utf8')).toBe(seedText('tenerife'));
});

test('a label dragged past the box stops where the pill meets it, and a release over a thumbnail never selects it', async ({ page }) => {
  const box = await mapBox(page);
  const label = stageMap(page).locator('#label-adeje-nest');
  const yOf = async () => Number(/translate\(\S+ (\S+)\)/.exec((await label.getAttribute('transform'))!)![1]);
  const before = await yOf();
  const from = await centreOf(label);
  const thumb = (await thumbnail(page, 'Gran Canaria · Hostels').boundingBox())!;
  const to = { x: Math.round(thumb.x + thumb.width / 2), y: Math.round(thumb.y + 12) };
  expect(to.y, 'the thumbnail must be in view').toBeLessThan(page.viewportSize()!.height);
  await drag(page, from, { x: to.x - from.x, y: to.y - from.y });
  await expect(caption(page)).toHaveText('Tenerife · Hostels');
  await expect(islandTab(page, 'tenerife')).toHaveAttribute('aria-selected', 'true');

  // The drag ran past the foot of the box: the nudge stored is clamped, and it is the one drawn.
  const stored = (await dataFile(page)).hostels.find((h) => h.slug === 'adeje-nest')!.labelPlacement;
  expect(stored.dy).toBeGreaterThan(0);
  expect(stored.dy).toBeLessThan(Math.round((to.y - from.y) * scaleOf(box)));
  expect((await yOf()) - before).toBeCloseTo(stored.dy, 0);
});

test('dragging a label works on the Things to do map too', async ({ page }) => {
  await tabOf(page, 'attractions').click();
  const box = await mapBox(page);
  const by = { x: 40, y: -30 };
  await drag(page, await centreOf(stageMap(page).locator('#label-teide')), by);
  const teide = (await dataFile(page)).attractions.find((a) => a.id === 'teide')!;
  expect(teide.labelPlacement).toEqual({ side: 'above', dx: Math.round(by.x * scaleOf(box)), dy: Math.round(by.y * scaleOf(box)) });
});

test('dragging a decor icon moves it and brings up the Decor tab', async ({ page }) => {
  const box = await mapBox(page);
  const by = { x: 30, y: 20 };
  await drag(page, await centreOf(stageMap(page).locator('#decor-sun')), by);
  await expect(tabOf(page, 'decor')).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, 'sun')).toBeVisible();
  // The stage keeps the map it had.
  await expect(caption(page)).toHaveText('Tenerife · Hostels');

  const start = seed().decor.find((d) => d.id === 'sun')!;
  const moved = (await dataFile(page)).decor.find((d) => d.id === 'sun')!;
  const [a, b] = [project(tenerife, start.lat, start.lng), project(tenerife, moved.lat, moved.lng)];
  expect(b.x - a.x).toBeCloseTo(by.x * scaleOf(box), 1);
  expect(b.y - a.y).toBeCloseTo(by.y * scaleOf(box), 1);
});

test('placing drops a new spot at the click; its button, Esc, a drag, another tab or island place nothing', async ({ page }) => {
  await tabOf(page, 'attractions').click();
  const banner = page.getByText('Click the island to drop a new spot · Esc to cancel', { exact: true });
  await placeButton(page).click();
  await expect(banner).toBeVisible();
  await expect(page.getByTestId('selected-map').locator('.map-frame')).toHaveCSS('cursor', 'crosshair');
  await cancelButton(page).click();
  await expect(banner).toHaveCount(0);

  await placeButton(page).click();
  await expect(banner).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(banner).toHaveCount(0);
  await expect(placeButton(page)).toBeVisible();

  // A drag while armed places nothing, and placing stays armed.
  await placeButton(page).click();
  const box = await mapBox(page);
  const click = clientAt(box, { x: 612, y: 470 });
  await drag(page, click, { x: 12, y: 0 });
  await expect(banner).toBeVisible();

  await page.mouse.click(click.x, click.y);
  await expect(page.getByRole('status')).toHaveText('Added — rename it in the list');
  await expect(banner).toHaveCount(0);
  await expect(stageMap(page).locator('#spot-new-spot')).toHaveCount(1);
  const data = await dataFile(page);
  expect(data.attractions).toHaveLength(seed().attractions.length + 1);
  const spot = data.attractions.find((a) => a.id === 'new-spot')!;
  expect(spot).toMatchObject({ label: 'New spot', icon: 'star' });
  landsAt(spot, artboardAt(box, click));

  // Another tab, or another island, cancels.
  await placeButton(page).click();
  await tabOf(page, 'hostels').click();
  await tabOf(page, 'attractions').click();
  await expect(placeButton(page)).toBeVisible();
  await placeButton(page).click();
  await islandTab(page, 'ibiza').click();
  await islandTab(page, 'tenerife').click();
  await expect(banner).toHaveCount(0);
  await expect(placeButton(page)).toBeVisible();
});

test('placing drops a decor icon at the click', async ({ page }) => {
  await tabOf(page, 'decor').click();
  await placeButton(page).click();
  await expect(page.getByText('Click the map to drop a decor icon · Esc to cancel', { exact: true })).toBeVisible();
  const box = await mapBox(page);
  const click = clientAt(box, { x: 880, y: 820 });
  await page.mouse.click(click.x, click.y);
  await expect(page.getByRole('status')).toHaveText('Icon added — click it in the list to change the icon');
  await expect(row(page, 'sun-2')).toBeVisible();
  landsAt((await dataFile(page)).decor.find((d) => d.id === 'sun-2')!, artboardAt(box, click));
});

test('placing a missing hostel drops it at the click, unverified, as the seed named it', async ({ page }) => {
  await expect(placeButton(page)).toHaveAttribute('aria-disabled', 'true');
  await row(page, 'adeje-nest').getByRole('button', { name: 'Remove Adeje', exact: true }).click();
  const list = page.getByRole('group', { name: 'Hostels to place on the map' });
  const arm = async () => {
    await placeButton(page).click();
    await list.getByRole('button', { name: 'Adeje Nest', exact: true }).click();
    await expect(page.getByText('Click the island to drop Adeje Nest · Esc to cancel', { exact: true })).toBeVisible();
  };

  // Armed, the button cancels rather than opening the list, and says so.
  await arm();
  await expect(cancelButton(page)).not.toHaveAttribute('aria-expanded');
  await cancelButton(page).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(list).toHaveCount(0);
  await arm();
  await page.keyboard.press('Escape');
  await expect(banner(page)).toHaveCount(0);
  // Brought back another way, there is nothing left to place.
  await arm();
  await page.getByRole('button', { name: '+ Add hostel', exact: true }).click();
  await page.getByRole('group', { name: 'Hostels not on the map' }).getByRole('button', { name: 'Adeje Nest', exact: true }).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(placeButton(page)).toHaveAttribute('aria-disabled', 'true');

  await row(page, 'adeje-nest').getByRole('button', { name: 'Remove Adeje', exact: true }).click();
  await arm();

  const box = await mapBox(page);
  const click = clientAt(box, { x: 400, y: 600 });
  await page.mouse.click(click.x, click.y);
  await expect(page.getByRole('status')).toHaveText('Adeje Nest added');
  const adeje = (await dataFile(page)).hostels.find((h) => h.slug === 'adeje-nest')!;
  const seeded = seed().hostels.find((h) => h.slug === 'adeje-nest')!;
  expect(adeje).toMatchObject({ label: 'Adeje', coordsVerified: false, labelPlacement: seeded.labelPlacement });
  landsAt(adeje, artboardAt(box, click));
  await expect(row(page, 'adeje-nest').getByRole('textbox', { name: 'Lat, lng' })).toHaveValue(`${adeje.lat}, ${adeje.lng}`);
});

test('"⌖ Place on map" moves a row’s point to the click, and its Lat, lng follows', async ({ page }) => {
  const puerto = row(page, 'puerto-nest');
  const placeOnMap = (r: Locator) => r.getByRole('button', { name: '⌖ Place on map', exact: true });
  await expect(puerto.getByText('In the sea')).toBeVisible();

  // Its own button cancels; removing the row it would move cancels too.
  await placeOnMap(puerto).click();
  await expect(page.getByText('Click the island to move Puerto · Esc to cancel', { exact: true })).toBeVisible();
  await puerto.getByRole('button', { name: 'Cancel placing', exact: true }).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(placeOnMap(puerto)).toBeVisible();
  await placeOnMap(row(page, 'aguere-nest')).click();
  await expect(page.getByText('Click the island to move Aguere · Esc to cancel', { exact: true })).toBeVisible();
  await row(page, 'aguere-nest').getByRole('button', { name: 'Remove Aguere', exact: true }).click();
  await expect(banner(page)).toHaveCount(0);

  await placeOnMap(puerto).click();
  await expect(puerto.getByRole('button', { name: 'Cancel placing', exact: true })).toBeVisible();
  await expect(page.getByText('Click the island to move Puerto · Esc to cancel', { exact: true })).toBeVisible();

  const box = await mapBox(page);
  // The middle of the island's box, on land.
  const click = clientAt(box, { x: 521, y: 539 });
  await page.mouse.click(click.x, click.y);
  await expect(page.getByRole('status')).toHaveText('Puerto moved');
  const moved = (await dataFile(page)).hostels.find((h) => h.slug === 'puerto-nest')!;
  landsAt(moved, artboardAt(box, click));
  expect(moved.coordsVerified).toBe(false);
  await expect(puerto.getByRole('textbox', { name: 'Lat, lng' })).toHaveValue(`${moved.lat}, ${moved.lng}`);
  await expect(puerto.getByText('In the sea')).toHaveCount(0);
});

test('a thumbnail puts its map on the stage, by click or by keyboard; on Decor the tab stays', async ({ page }) => {
  await thumbnail(page, 'Gran Canaria · Things to do').click();
  await expect(caption(page)).toHaveText('Gran Canaria · Things to do');
  await expect(islandTab(page, 'gran_canaria')).toHaveAttribute('aria-selected', 'true');
  await expect(tabOf(page, 'attractions')).toHaveAttribute('aria-selected', 'true');
  await expect(thumbnail(page, 'Tenerife · Hostels')).toBeVisible();

  // From the keyboard, focus goes on from the map now on the stage.
  await thumbnail(page, 'Ibiza · Hostels').focus();
  await page.keyboard.press('Enter');
  await expect(caption(page)).toHaveText('Ibiza · Hostels');
  await expect(tabOf(page, 'hostels')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('selected-map')).toBeFocused();

  await tabOf(page, 'decor').click();
  await thumbnail(page, 'Ibiza · Things to do').click();
  await expect(caption(page)).toHaveText('Ibiza · Things to do');
  await expect(tabOf(page, 'decor')).toHaveAttribute('aria-selected', 'true');
  await thumbnail(page, 'Tenerife · Hostels').click();
  await expect(caption(page)).toHaveText('Tenerife · Hostels');
  await expect(islandTab(page, 'tenerife')).toHaveAttribute('aria-selected', 'true');
  await expect(tabOf(page, 'decor')).toHaveAttribute('aria-selected', 'true');
});
