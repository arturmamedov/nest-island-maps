import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/* The editor must not ship react-dom/server in what it loads up front:
   src/export/svg.ts is imported dynamically at export time. `npm run
   test:render` builds first, so dist/ is this build. The check follows every
   static import from the editor's entry script. */

const DIST = join(import.meta.dirname, '..', '..', 'dist');
const MARKER = 'renderToStaticMarkup';

const read = (file: string) => readFileSync(join(DIST, file), 'utf8');

/** The entry script of dist/index.html plus every chunk it imports statically, transitively. */
function staticClosure(): string[] {
  const entry = /<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"/.exec(read('index.html'))?.[1];
  expect(entry, 'entry script in dist/index.html').toBeDefined();
  const seen = new Set<string>([entry!]);
  for (const file of seen) {
    // Static imports only: `from"./x.js"` or `import"./x.js"`; a dynamic `import("./x.js")` is skipped.
    for (const [, dep] of read(file).matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) seen.add(`assets/${dep}`);
  }
  return [...seen];
}

test('the editor loads no react-dom/server until an export runs', () => {
  const upFront = staticClosure();
  for (const file of upFront) expect(read(file), file).not.toContain(MARKER);

  // Positive control: the server renderer is in the build, in a chunk of its own.
  const lazy = readdirSync(join(DIST, 'assets'))
    .filter((f) => f.endsWith('.js') && read(`assets/${f}`).includes(MARKER))
    .map((f) => `assets/${f}`);
  expect(lazy).toHaveLength(1);
  expect(upFront).not.toContain(lazy[0]);
});
