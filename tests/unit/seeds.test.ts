import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import hostelsFile from '../../data/hostels.json';
import { ISLANDS } from '../../src/shared/islands.js';
import { ISLAND_IDS } from '../../src/shared/schema.js';
import { NEST_PASS } from '../../src/shared/tokens.js';

/* The committed seeds are production data: every hostel is a real one from
   the flyers repo, on its own island, and coordinates stay flagged
   unverified until the owner confirms each pin. */

const ROOT = join(import.meta.dirname, '..', '..');

describe('seed data', () => {
  it('covers all 14 hostels of data/hostels.json exactly once', () => {
    const onMaps = ISLAND_IDS.flatMap((id) => ISLANDS[id].seed.hostels.map((h) => h.slug)).sort();
    expect(onMaps).toEqual(hostelsFile.hostels.map((h) => h.slug).sort());
    expect(onMaps).toHaveLength(14);
  });

  for (const id of ISLAND_IDS) {
    const { seed, geometry } = ISLANDS[id];

    it(`${id}: hostels belong to the island`, () => {
      const canonical = hostelsFile.hostels.filter((h) => h.island === id).map((h) => h.slug);
      for (const h of seed.hostels) expect(canonical).toContain(h.slug);
    });

    it(`${id}: file name, island id and geometry name agree`, () => {
      expect(seed.island).toBe(id);
      expect(seed.name).toBe(geometry.name);
    });

    it(`${id}: carries the geometry's projection and the artboard`, () => {
      const file = JSON.parse(readFileSync(join(ROOT, 'data/seed', `${id}.json`), 'utf8'));
      expect(file.projection).toEqual(geometry.projection);
      expect(file.artboard).toEqual([1080, 1080]);
    });
  }

  it('flags no hostel as verified until the owner confirms its pin', () => {
    for (const id of ISLAND_IDS) {
      for (const h of ISLANDS[id].seed.hostels) expect(h.coordsVerified, h.slug).toBe(false);
    }
  });

  it('keeps Nest Pass wording off the Ibiza seed', () => {
    expect(readFileSync(join(ROOT, 'data/seed/ibiza.json'), 'utf8')).not.toMatch(NEST_PASS);
  });
});
