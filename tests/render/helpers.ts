import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
// JSON-free modules only: Playwright's ESM loader refuses schema.ts's JSON imports.
import { ISLAND_IDS, LAYERS, TAB_LABELS, type TABS } from '../../src/shared/ids.js';

/* What the editor specs share: the repo root, the islands' names (read from
   the geometry files, since the loader can't import JSON), map selection and
   downloads captured as staff would get them. */

export const ROOT = join(import.meta.dirname, '..', '..');

export type IslandId = (typeof ISLAND_IDS)[number];
export type Layer = (typeof LAYERS)[number];

export const islandName = (id: IslandId): string => JSON.parse(readFileSync(join(ROOT, 'data/geometry', `${id}.geo.json`), 'utf8')).name;

/** The committed seed file's text. */
export const seedText = (id: IslandId): string => readFileSync(join(ROOT, 'data/seed', `${id}.json`), 'utf8');

/** A list tab ("Hostels · 9"), whatever its count. */
export const tabOf = (page: Page, tab: (typeof TABS)[number]) =>
  page.getByRole('tablist', { name: 'Map' }).getByRole('tab', { name: new RegExp(`^${TAB_LABELS[tab]} · `) });

export async function selectMap(page: Page, island: IslandId, layer: Layer) {
  await page.getByRole('tablist', { name: 'Island' }).getByRole('tab', { name: islandName(island), exact: true }).click();
  await tabOf(page, layer).click();
}

/** Clicks an export button and returns the downloaded file. */
export async function download(page: Page, button: string) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button, exact: true }).click()]);
  return { name: file.suggestedFilename(), bytes: readFileSync(await file.path()) };
}
