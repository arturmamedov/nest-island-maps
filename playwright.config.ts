import { defineConfig } from '@playwright/test';

/* Render checks against the production build (`npm run test:render` builds
   first), served by `vite preview`. The goldens are win32 screenshots of the
   bare render page, committed under tests/render/goldens/. */

export default defineConfig({
  testDir: './tests/render',
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/goldens/{arg}-{platform}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, threshold: 0.1 },
  },
  use: {
    baseURL: 'http://127.0.0.1:8798',
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 1,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 8798 --strictPort',
    url: 'http://127.0.0.1:8798/render.html',
    reuseExistingServer: false,
  },
});
