import { describe, expect, it } from 'vitest';
import hostelsFile from '../../data/hostels.json';
import { parseDataFile, serializeDataFile } from '../../src/shared/datafile.js';
import { ISLANDS } from '../../src/shared/islands.js';
import { CANONICAL_HOSTELS, canonicalHostels, IslandDataSchema, parseLabel, type IslandData } from '../../src/shared/schema.js';

/* The integrity rules zod enforces on every island file: the seed, the
   autosaved draft and any imported JSON all go through IslandDataSchema. */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const tenerife = () => clone(ISLANDS.tenerife.seed) as IslandData;
const ibiza = () => clone(ISLANDS.ibiza.seed) as IslandData;

function issues(value: unknown): string[] {
  const r = IslandDataSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe('IslandDataSchema', () => {
  it('fills in default settings when a file has none', () => {
    const { settings: _, ...bare } = tenerife();
    const parsed = IslandDataSchema.parse(bare);
    expect(parsed.settings).toEqual({
      palette: 'original',
      labelFont: 'robotoCondensed',
      labelSize: 25,
      labelTracking: 0.19,
      labelStyle: 'accent',
      pinStyle: 'pin',
      pinSize: 0.9,
      rings: 4,
      showIcons: true,
    });
  });

  it('keeps label case as typed, trims and NFC-normalises it', () => {
    const d = tenerife();
    d.hostels[0]!.label = '  Médano ';
    expect(IslandDataSchema.parse(d).hostels[0]!.label).toBe('Médano');
  });

  it('refuses characters the label fonts cannot draw', () => {
    const d = tenerife();
    d.attractions[0]!.label = 'Teide 🌋';
    expect(issues(d).join()).toMatch(/character/i);
  });

  it('refuses a hostel slug that is not in data/hostels.json', () => {
    const d = tenerife();
    d.hostels[0]!.slug = 'new-nest';
    expect(issues(d).length).toBeGreaterThan(0);
  });

  it("refuses another island's hostel", () => {
    const d = tenerife();
    d.hostels[0]!.slug = 'cisne-nest';
    expect(issues(d).join()).toMatch(/not a Tenerife hostel/);
  });

  it('refuses duplicate ids', () => {
    const d = tenerife();
    d.hostels.push(clone(d.hostels[0]!));
    d.decor.push(clone(d.decor[0]!));
    expect(issues(d).filter((m) => /twice/.test(m))).toHaveLength(2);
  });

  it('refuses a route to a hostel that is not on the map', () => {
    const d = tenerife();
    d.routes[0]!.to = 'adeje-nest';
    d.hostels = d.hostels.filter((h) => h.slug !== 'adeje-nest');
    expect(issues(d).join()).toMatch(/route/i);
  });

  it('refuses an unknown icon', () => {
    const d = tenerife();
    (d.attractions[0] as { icon: string }).icon = 'volcano';
    expect(issues(d).length).toBeGreaterThan(0);
  });

  it('enforces the Ibiza firewall: no Nest Pass content on an Ibiza map', () => {
    const d = ibiza();
    d.attractions[0]!.label = 'Nest Pass tour';
    expect(issues(d).join()).toMatch(/Nest Pass/);
    const e = ibiza();
    e.decor[0]!.id = 'nestpass-sun';
    expect(issues(e).join()).toMatch(/Nest Pass/);
  });

  it('lets Nest Pass wording through on the Canaries', () => {
    const d = tenerife();
    d.attractions[0]!.label = 'Nest Pass tour';
    expect(issues(d)).toEqual([]);
  });
});

/* The label rule on its own, for the row input and the edits: the same rule
   the schema applies to a whole file, plus the Ibiza firewall. */
describe('parseLabel', () => {
  it('keeps the case as typed, trims and NFC-normalises', () => {
    expect(parseLabel('  El Médano ', 'tenerife')).toEqual({ ok: true, label: 'El Médano' });
  });

  it('refuses an empty label', () => {
    const r = parseLabel('   ', 'tenerife');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/empty/i);
  });

  it('refuses more than 40 characters, saying so', () => {
    expect(parseLabel('x'.repeat(40), 'tenerife').ok).toBe(true);
    const r = parseLabel('x'.repeat(41), 'tenerife');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('At most 40 characters');
  });

  it('refuses characters the label fonts cannot draw', () => {
    const r = parseLabel('Teide 🌋', 'tenerife');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/character/i);
  });

  it('refuses Nest Pass on Ibiza only', () => {
    const r = parseLabel('Nest  pass tour', 'ibiza');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Nest Pass/);
    expect(parseLabel('Nest Pass tour', 'tenerife').ok).toBe(true);
  });
});

describe('canonical hostels', () => {
  it('are data/hostels.json, in its order', () => {
    expect(CANONICAL_HOSTELS).toEqual(hostelsFile.hostels);
  });

  it('are listed per island', () => {
    expect(canonicalHostels('ibiza').map((h) => h.slug)).toEqual(['cisne-nest', 'flamingo-nest']);
    expect(canonicalHostels('tenerife')).toHaveLength(9);
  });
});

describe('parseDataFile', () => {
  it('round-trips the Download JSON file', () => {
    const text = serializeDataFile(ISLANDS.gran_canaria.seed, ISLANDS.gran_canaria.geometry);
    const r = parseDataFile(JSON.parse(text), ISLANDS.gran_canaria);
    expect(r.ok).toBe(true);
    if (r.ok) expect(serializeDataFile(r.data, ISLANDS.gran_canaria.geometry)).toBe(text);
  });

  it('refuses a file for another island', () => {
    const text = serializeDataFile(ISLANDS.ibiza.seed, ISLANDS.ibiza.geometry);
    const r = parseDataFile(JSON.parse(text), ISLANDS.tenerife);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Ibiza/);
  });

  it('refuses a file whose projection does not match the geometry', () => {
    const file = JSON.parse(serializeDataFile(ISLANDS.tenerife.seed, ISLANDS.tenerife.geometry));
    file.projection.s += 1;
    const r = parseDataFile(file, ISLANDS.tenerife);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/projection/i);
  });

  it('reports schema problems with their path', () => {
    const file = JSON.parse(serializeDataFile(ISLANDS.tenerife.seed, ISLANDS.tenerife.geometry));
    file.hostels[2].lat = 'north';
    const r = parseDataFile(file, ISLANDS.tenerife);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/hostels\.2\.lat/);
  });
});
