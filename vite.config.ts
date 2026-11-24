import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  appType: 'mpa',
  // Relative asset URLs in the build, so one static build runs at a domain
  // root or in a subfolder (it lives at nestpass.ai/nestmaps/). Dev keeps '/'.
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        // The bare map page the Playwright goldens screenshot.
        render: resolve(import.meta.dirname, 'render.html'),
      },
    },
  },
});
