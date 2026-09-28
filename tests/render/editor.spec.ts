import { expect, test, type Page } from '@playwright/test';
// JSON-free modules only: Playwright's ESM loader refuses schema.ts's JSON imports.
import { STORAGE_KEYS } from '../../src/editor/browserStorage.js';
import { dataFileName } from '../../src/shared/filename.js';
import { download, seedText, tabOf } from './helpers.js';

/* The editor as staff use it (M4): edit rows and settings in the built app,
   then check what reaches the exported SVG and what survives a reload,
   Download → Reset → Import, and a newer published seed. Every test starts
   from a fresh context, so from the published seeds: no draft is ever shared
   between tests (export.spec's "Download JSON = seed" relies on that). */

const RED = 'rgb(209, 86, 83)'; // #D15653, the spec's error colour

const row = (page: Page, key: string) => page.locator(`[data-key="${key}"]`);
const nameInput = (page: Page, key: string) => row(page, key).getByRole('textbox', { name: 'Name' });
const coordsInput = (page: Page, key: string) => row(page, key).getByRole('textbox', { name: 'Lat, lng' });
/** A settings choice: a pressed button in the group named after the setting. */
const choice = (page: Page, setting: string, option: string) =>
  page.getByRole('group', { name: setting, exact: true }).getByRole('button', { name: option, exact: true });
/** The large map on the stage (all six maps are on the page, with the same layer ids). */
const stageMap = (page: Page) => page.getByTestId('selected-map').locator('svg');
const figmaSvg = async (page: Page) => (await download(page, 'SVG (Figma)')).bytes.toString('utf8');

async function resetIsland(page: Page) {
  await page.getByRole('button', { name: 'Reset island' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
}

/** Puts a draft in storage before the app first loads, once per tab: reloads must read what the app itself saved. */
async function seedDraft(page: Page, value: string) {
  await page.addInitScript(
    ([key, v]) => {
      if (sessionStorage.getItem('draft-seeded')) return;
      sessionStorage.setItem('draft-seeded', '1');
      localStorage.setItem(key, v);
    },
    [STORAGE_KEYS.draft, value] as const,
  );
  await page.goto('/index.html');
}

async function importFile(page: Page, file: { name: string; buffer: Buffer }) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import JSON' }).click()]);
  await chooser.setFiles({ ...file, mimeType: 'application/json' });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

test('rename: the new label reaches the SVG in capitals', async ({ page }) => {
  await nameInput(page, 'adeje-nest').fill('Adeje Beach');
  await expect(stageMap(page).locator('#label-adeje-nest text')).toHaveText('ADEJE BEACH');
  const svg = await figmaSvg(page);
  expect(svg).toContain('>ADEJE BEACH</text>');
  expect(svg).not.toContain('>ADEJE</text>');
});

test('a label the file would refuse stays in the input, red, and the map keeps the last good one', async ({ page }) => {
  const input = nameInput(page, 'adeje-nest');
  for (const bad of ['', 'Adeje 🌋', 'x'.repeat(41)]) {
    await input.fill(bad);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveCSS('border-top-color', RED);
    await expect(stageMap(page).locator('#label-adeje-nest text')).toHaveText('ADEJE');
  }
  await input.fill('Adeje');
  await expect(input).toHaveAttribute('aria-invalid', 'false');
});

test('a bad coordinate turns the border red and leaves the pin where it was', async ({ page }) => {
  const input = coordsInput(page, 'adeje-nest');
  const pin = stageMap(page).locator('#pin-adeje-nest');
  const before = (await pin.getAttribute('transform'))!;

  await input.fill('28.1225, abc');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveCSS('border-top-color', RED);
  await expect(input).toHaveAttribute('title', /lat, lng/);
  await expect(pin).toHaveAttribute('transform', before);

  // A Maps link carries the viewport, not the pin (decision 13).
  await input.fill('https://www.google.com/maps/@28.13,-16.72,15z');
  await expect(input).toHaveAttribute('title', /Maps link/);
  await expect(pin).toHaveAttribute('transform', before);

  await input.fill('28.13, -16.72');
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await expect(pin).not.toHaveAttribute('transform', before);
});

test('toggle: a hidden hostel leaves the map and the count', async ({ page }) => {
  const tab = tabOf(page, 'hostels');
  await expect(tab).toHaveText('Hostels · 9');
  await row(page, 'adeje-nest').getByRole('button', { name: 'Visible' }).click();
  await expect(tab).toHaveText('Hostels · 8');
  await expect(stageMap(page).locator('#label-adeje-nest')).toHaveCount(0);
  expect(await figmaSvg(page)).not.toContain('id="label-adeje-nest"');

  await row(page, 'adeje-nest').getByRole('button', { name: 'Visible' }).click();
  await expect(stageMap(page).locator('#label-adeje-nest')).toHaveCount(1);
});

test('a settings change reaches the SVG of both maps of the island', async ({ page }) => {
  await choice(page, 'Palette', 'Brand teal').click();
  await choice(page, 'Rings', '2').click();
  await page.getByRole('combobox', { name: 'Font' }).selectOption({ label: 'Poppins' });

  for (const tab of ['hostels', 'attractions'] as const) {
    await tabOf(page, tab).click();
    const svg = await figmaSvg(page);
    expect(svg).toContain('stop-color="#53CED1"');
    expect(svg).toContain('id="ring-2"');
    expect(svg).not.toContain('id="ring-3"');
    expect(svg).toContain('font-family="Poppins, sans-serif"');
  }
});

test('reload keeps the edits', async ({ page }) => {
  await nameInput(page, 'adeje-nest').fill('Adeje Beach');
  await choice(page, 'Palette', 'Brand teal').click();
  // Straight away: the debounced save must still be flushed when the page goes.
  await page.reload();
  await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje Beach');
  await expect(choice(page, 'Palette', 'Brand teal')).toHaveAttribute('aria-pressed', 'true');
  await expect(stageMap(page).locator('#label-adeje-nest text')).toHaveText('ADEJE BEACH');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('import/export round trip: Download JSON, Reset, Import brings the edits back', async ({ page }) => {
  await nameInput(page, 'adeje-nest').fill('Adeje Beach');
  await choice(page, 'Rings', '3').click();
  const edited = await download(page, 'Download JSON');
  expect(edited.name).toBe(dataFileName('tenerife'));
  expect(edited.bytes.toString('utf8')).not.toBe(seedText('tenerife'));

  await resetIsland(page);
  await expect(page.getByRole('status')).toHaveText('Tenerife back to defaults');
  await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje');
  expect((await download(page, 'Download JSON')).bytes.toString('utf8')).toBe(seedText('tenerife'));

  await importFile(page, { name: edited.name, buffer: edited.bytes });
  await expect(page.getByRole('status')).toHaveText('Tenerife imported');
  await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje Beach');
  await expect(choice(page, 'Rings', '3')).toHaveAttribute('aria-pressed', 'true');
  expect((await download(page, 'Download JSON')).bytes.equals(edited.bytes)).toBe(true);
});

test('import refuses another island’s file and a file that is not JSON, saying why', async ({ page }) => {
  await importFile(page, { name: dataFileName('ibiza'), buffer: Buffer.from(seedText('ibiza')) });
  await expect(page.getByRole('status')).toHaveText('Import failed: This file is for Ibiza, not Tenerife');
  await importFile(page, { name: 'notes.json', buffer: Buffer.from('not json') });
  await expect(page.getByRole('status')).toHaveText('Import failed: that file is not JSON');
  expect((await download(page, 'Download JSON')).bytes.toString('utf8')).toBe(seedText('tenerife'));
});

test('reset asks first, then restores the published island', async ({ page }) => {
  const input = nameInput(page, 'adeje-nest');
  await input.fill('Adeje Beach');
  const resetButton = page.getByRole('button', { name: 'Reset island' });
  await resetButton.click();
  // The question takes the focus on its safe answer, and hands it back after either answer.
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(resetButton).toBeFocused();
  await expect(input).toHaveValue('Adeje Beach');

  await resetIsland(page);
  await expect(page.getByRole('status')).toHaveText('Tenerife back to defaults');
  await expect(resetButton).toBeFocused();
  await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje');
  await page.reload();
  await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje');
});

test('reset clears text the data never took, even when the data did not change', async ({ page }) => {
  const input = nameInput(page, 'adeje-nest');
  await input.fill('');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await resetIsland(page);
  await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje');
  await expect(nameInput(page, 'adeje-nest')).toHaveAttribute('aria-invalid', 'false');
});

test('things to do, decor and routes edit from their tabs', async ({ page }) => {
  await tabOf(page, 'attractions').click();
  await page.getByRole('button', { name: '+ Add row' }).click();
  await expect(page.getByRole('status')).toHaveText('Added — rename it in the list');
  // The new spot's name is focused and selected, ready to be typed over.
  await page.keyboard.type('Playa Jardín');
  await expect(nameInput(page, 'new-spot')).toHaveValue('Playa Jardín');
  await row(page, 'teide').getByRole('button', { name: /^Icon: / }).click();
  await row(page, 'teide').getByRole('button', { name: 'Peak', exact: true }).click();
  await expect(row(page, 'teide').getByRole('button', { name: 'Icon: Peak' })).toBeVisible();
  const spots = await figmaSvg(page);
  expect(spots).toContain('>PLAYA JARDÍN</text>');
  expect(spots).toContain('id="spot-new-spot"');

  await tabOf(page, 'decor').click();
  await row(page, 'sun').getByRole('slider', { name: 'Size' }).fill('80');
  await expect(stageMap(page).locator('#decor-sun')).toHaveAttribute('transform', /scale\(3\.33\)/);
  await row(page, 'sun').getByRole('button', { name: /^Show on: / }).click();
  await expect(row(page, 'sun').getByRole('button', { name: 'Show on: Hostels' })).toBeVisible();

  await row(page, 'puerto-arena').getByRole('button', { name: 'From: Puerto' }).click();
  await expect(row(page, 'puerto-arena').getByRole('button', { name: 'From: Las Eras' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add route' }).click();
  await expect(page.getByRole('status')).toHaveText('Route added');
  await expect(row(page, 'aguere-puerto')).toBeVisible();

  // The stage shows the Things to do map: the sun now only shows on Hostels.
  const map = await figmaSvg(page);
  expect(map).not.toContain('id="decor-sun"');
});

test('a hostel comes back only from the island’s real hostels, as its seed had it', async ({ page }) => {
  const allOnMap = page.getByRole('button', { name: 'All 9 Tenerife hostels are on the map' });
  await expect(allOnMap).toBeDisabled();
  await row(page, 'puerto-nest').getByRole('button', { name: 'Remove Puerto' }).click();
  await expect(page.getByRole('status')).toHaveText('Removed, with 1 route');
  // × takes its row away; focus moves on to the next row's ×.
  await expect(row(page, 'las-eras-nest').getByRole('button', { name: 'Remove Las Eras' })).toBeFocused();
  await row(page, 'adeje-nest').getByRole('button', { name: 'Remove Adeje' }).click();

  // Not a select: the arrow keys on the closed button add nothing.
  const add = page.getByRole('button', { name: '+ Add hostel' });
  await add.focus();
  await page.keyboard.press('ArrowDown');
  await expect(add).toHaveAttribute('aria-expanded', 'false');
  await expect(row(page, 'adeje-nest')).toHaveCount(0);

  const menu = page.getByRole('group', { name: 'Hostels not on the map' });
  await add.click();
  await expect(menu.getByRole('button')).toHaveText(['Adeje Nest', 'Puerto Nest']);
  await expect(menu.getByRole('button', { name: 'Adeje Nest' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(add).toBeFocused();

  await add.click();
  await menu.getByRole('button', { name: 'Puerto Nest' }).click();
  await expect(page.getByRole('status')).toHaveText('Puerto Nest added');
  await expect(add).toBeFocused();
  await expect(nameInput(page, 'puerto-nest')).toHaveValue('Puerto');
  await expect(row(page, 'puerto-nest').getByText('In the sea')).toBeVisible();
  // Verifying removes the badge; focus goes to the row's name.
  await row(page, 'puerto-nest').getByRole('button', { name: 'Unverified' }).click();
  await expect(row(page, 'puerto-nest').getByRole('button', { name: 'Unverified' })).toHaveCount(0);
  await expect(nameInput(page, 'puerto-nest')).toBeFocused();

  // The last one: the same button keeps the focus, with nothing left to add.
  await add.click();
  await menu.getByRole('button', { name: 'Adeje Nest' }).click();
  await expect(allOnMap).toBeFocused();
  await expect(allOnMap).toBeDisabled();
});

test.describe('a saved draft that cannot be read', () => {
  test('is reported, and its notice goes once an edit replaces it', async ({ page }) => {
    await seedDraft(page, 'not json');
    await expect(page.getByRole('alert')).toContainText('The saved draft couldn’t be read (not a draft this editor can read)');
    await nameInput(page, 'adeje-nest').fill('Adeje Beach');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.reload();
    await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje Beach');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('an island’s unreadable draft can be dismissed for good', async ({ page }) => {
    await seedDraft(page, JSON.stringify({ version: 1, islands: { ibiza: 42 } }));
    const notice = page.getByRole('alert');
    await expect(notice).toContainText('Ibiza: the saved draft couldn’t be read (not a saved island draft)');
    await notice.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Map data' })).toBeFocused();
    await page.reload();
    await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('a newer published seed under a draft (decision 9)', () => {
  /** A draft saved against an older Tenerife seed (Adeje renamed, a base hash no seed has), plus any `others`. */
  async function seedStaleDraft(page: Page, others: Record<string, unknown> = {}) {
    const data = JSON.parse(seedText('tenerife'));
    data.hostels.find((h: { slug: string }) => h.slug === 'adeje-nest').label = 'Adeje Beach';
    await seedDraft(page, JSON.stringify({ version: 1, islands: { tenerife: { base: '00000000', data }, ...others } }));
  }

  test('warns until someone chooses; Keep draft keeps the edits', async ({ page }) => {
    await seedStaleDraft(page);
    const notice = page.getByRole('alert');
    await expect(notice).toContainText('Tenerife: the published map changed since this draft was saved.');
    await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje Beach');

    await page.reload();
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'Keep draft' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.reload();
    // A positive sign of the mounted editor first, or "no notice" could pass on an empty page.
    await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje Beach');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('an answer moves focus to a notice line, never onto a button', async ({ page }) => {
    await seedStaleDraft(page, { gran_canaria: 42, ibiza: 42 });
    const lines = page.locator('.notice-line');
    await expect(lines).toHaveCount(3);
    // The line that takes the answered one's place.
    await lines.nth(0).getByRole('button', { name: 'Keep draft' }).click();
    await expect(lines).toHaveCount(2);
    await expect(lines.nth(0)).toContainText('Gran Canaria');
    await expect(lines.nth(0)).toBeFocused();
    // The last line answered: the one before it.
    await lines.nth(1).getByRole('button', { name: 'Dismiss' }).click();
    await expect(lines).toHaveCount(1);
    await expect(lines.nth(0)).toBeFocused();
    // None left, answered from the keyboard: the panel heading.
    await lines.nth(0).getByRole('button', { name: 'Dismiss' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Map data' })).toBeFocused();
  });

  test('Load published replaces the draft with the seed', async ({ page }) => {
    await seedStaleDraft(page);
    await page.getByRole('alert').getByRole('button', { name: 'Load published' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje');
    await page.reload();
    await expect(nameInput(page, 'adeje-nest')).toHaveValue('Adeje');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
