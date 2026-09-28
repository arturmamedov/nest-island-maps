import { expect, test } from '@playwright/test';
// ids.ts, not schema.ts: Playwright's ESM loader refuses schema.ts's JSON imports.
import { ISLAND_IDS, LAYERS } from '../../src/shared/ids.js';

/* Pixel goldens of the six maps, drawn by the real renderer with the real
   fonts in Chromium. They catch what the SVG snapshots cannot: font loading,
   measured pill widths, filters and gradients as a browser paints them.
   Regenerate only on purpose (`npx playwright test --update-snapshots`), then
   look at every PNG before committing it. */

for (const island of ISLAND_IDS) {
  for (const layer of LAYERS) {
    test(`${island} ${layer}`, async ({ page }) => {
      await page.goto(`/render.html?island=${island}&layer=${layer}`);
      await page.waitForFunction(() => window.__MAP_READY === true || window.__MAP_ERROR !== undefined);
      expect(await page.evaluate(() => window.__MAP_ERROR)).toBeUndefined();
      await expect(page.locator('svg')).toHaveScreenshot(`${island}-${layer}.png`, { omitBackground: true });
    });
  }
}
