import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { parseDataFile, serializeDataFile } from '../src/shared/datafile.js';
import { GeometrySchema, ISLAND_IDS, IslandDataSchema } from '../src/shared/schema.js';

/* Derived copies of the shared sources of truth. Run `npm run gen` after
   changing src/shared or hand-editing a seed; tests/unit/generated.test.ts
   fails while a committed copy is stale.

   - schema/*.schema.json: JSON Schema for the WordPress theme (input mode:
     files may omit settings and rely on defaults).
   - data/seed/*.json: rewritten in canonical form, byte-identical to what the
     app's "Download data (JSON)" produces, so a downloaded file commits clean. */

export const ROOT = join(import.meta.dirname, '..');

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

/** Every generated file, keyed by its path relative to the repo root. */
export function generate(read: (rel: string) => string = (rel) => readFileSync(join(ROOT, rel), 'utf8')): Record<string, string> {
  const out: Record<string, string> = {
    'schema/island-data.schema.json': json(z.toJSONSchema(IslandDataSchema, { io: 'input' })),
    'schema/geometry.schema.json': json(z.toJSONSchema(GeometrySchema, { io: 'input' })),
  };
  for (const id of ISLAND_IDS) {
    const rel = `data/seed/${id}.json`;
    const geometry = GeometrySchema.parse(JSON.parse(read(`data/geometry/${id}.geo.json`)));
    const r = parseDataFile(JSON.parse(read(rel)), { id, geometry });
    if (!r.ok) throw new Error(`${rel}: ${r.error}`);
    out[rel] = serializeDataFile(r.data, geometry);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let changed = 0;
  for (const [rel, content] of Object.entries(generate())) {
    const file = join(ROOT, rel);
    if (existsSync(file) && readFileSync(file, 'utf8') === content) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`wrote ${rel}`);
    changed++;
  }
  console.log(changed ? `${changed} file(s) regenerated.` : 'Generated files are up to date.');
}
