import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, generate } from '../../scripts/gen-shared.js';

/* The committed derived files must be current: run `npm run gen` after
   changing src/shared or editing a seed by hand. */

const outputs = generate();

describe('generated files', () => {
  for (const [rel, content] of Object.entries(outputs)) {
    it(`${rel} is up to date (npm run gen)`, () => {
      const file = join(ROOT, rel);
      expect(existsSync(file), `${rel} is missing`).toBe(true);
      expect(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).toBe(content);
    });
  }

  it('island-data.schema.json lists the canonical hostel slugs', () => {
    const schema = JSON.parse(outputs['schema/island-data.schema.json']!);
    expect(schema.properties.hostels.items.properties.slug.enum).toContain('medano-nest');
  });
});
