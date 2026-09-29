import { describe, expect, it } from 'vitest';
import {
  addAttraction,
  addDecor,
  addHostel,
  addRoute,
  applyEdit,
  cycleRouteEnd,
  cycleShowOn,
  importFile,
  markVerified,
  missingHostels,
  placeAt,
  remove,
  resetIsland,
  setBend,
  setCoords,
  setDecorSize,
  setIcon,
  setLabel,
  setNudge,
  setSettings,
  setSide,
  setVisible,
  tryEdit,
  type EditResult,
  type IslandEdit,
} from '../../src/editor/state.js';
import { seedWorkspace } from '../../src/editor/workspace.js';
import { OFF_MAP } from '../../src/shared/coords.js';
import { issueText, serializeDataFile } from '../../src/shared/datafile.js';
import { project } from '../../src/shared/geo.js';
import { ISLANDS, type IslandEntry } from '../../src/shared/islands.js';
import { IslandDataSchema, type IslandData } from '../../src/shared/schema.js';

/* The editor's pure edits (spec §2 "Interactions", plan decisions 3 and 13).
   Every edit returns new data or a refusal, and never data the schema would
   refuse: each helper below checks the schema on every result it hands out. */

const T = ISLANDS.tenerife;
const GC = ISLANDS.gran_canaria;
const IB = ISLANDS.ibiza;

const valid = (d: IslandData) => {
  const r = IslandDataSchema.safeParse(d);
  expect(r.success, r.success ? '' : r.error.issues.map(issueText).join('; ')).toBe(true);
};

/** Runs one edit (on the seed unless told otherwise) and returns the data, failing the test on a refusal. */
function ok(edit: IslandEdit, island: IslandEntry = T, data: IslandData = island.seed): IslandData {
  const r = tryEdit(data, island, edit);
  if (!r.ok) throw new Error(`refused: ${r.error}`);
  valid(r.data);
  return r.data;
}

/** Runs a chain of edits from the seed, each on the result of the last. */
const chain = (island: IslandEntry, ...edits: IslandEdit[]) => edits.reduce((d, e) => ok(e, island, d), island.seed);

function refused(r: EditResult, message: RegExp | string) {
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(message);
}

const bytes = (d: IslandData, island: IslandEntry = T) => serializeDataFile(d, island.geometry);
const hostel = (d: IslandData, slug: string) => d.hostels.find((h) => h.slug === slug)!;
const route = (d: IslandData, id: string) => d.routes.find((r) => r.id === id)!;
const at = (island: IslandEntry, p: { lat: number; lng: number }) => project(island.geometry.projection, p.lat, p.lng);

describe('applying edits', () => {
  it('changes only the edited island', () => {
    const ws = seedWorkspace();
    const next = applyEdit(ws, T, setVisible('hostels', 'adeje-nest', false));
    expect(next).not.toBe(ws);
    expect(hostel(next.tenerife, 'adeje-nest').visible).toBe(false);
    expect(next.ibiza).toBe(ws.ibiza);
    expect(next.gran_canaria).toBe(ws.gran_canaria);
  });

  it('leaves the workspace as it was when an edit is refused', () => {
    const ws = seedWorkspace();
    expect(applyEdit(ws, T, setLabel('hostels', 'adeje-nest', ''))).toBe(ws);
  });

  it('refuses, with the path, anything the schema refuses: the backstop behind every edit', () => {
    const duplicate: IslandEdit = (d) => ({ ok: true, data: { ...d, hostels: [...d.hostels, d.hostels[0]!] } });
    refused(tryEdit(T.seed, T, duplicate), /^hostels\.9\.slug: .*twice/);
    const ws = seedWorkspace();
    expect(applyEdit(ws, T, duplicate)).toBe(ws);
  });

  it('keeps the data in the file’s key order, so Download JSON stays canonical', () => {
    const reversed = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).reverse()) as T;
    const shuffled: IslandEdit = (d) => ({ ok: true, data: { ...d, hostels: d.hostels.map(reversed) } });
    // Control: before the backstop, the keys really are out of order.
    const raw = shuffled(T.seed, T);
    expect(raw.ok && Object.keys(raw.data.hostels[0]!)[0]).toBe('visible');
    expect(bytes(ok(shuffled))).toBe(bytes(T.seed));
  });
});

describe('labels', () => {
  it('stores the label trimmed and NFC-normalised, as typed', () => {
    const d = ok(setLabel('hostels', 'adeje-nest', '  Adeje Béach '));
    expect(hostel(d, 'adeje-nest').label).toBe('Adeje Béach');
    expect(ok(setLabel('attractions', 'teide', 'Pico del Teide')).attractions[0]!.label).toBe('Pico del Teide');
  });

  it.each([
    ['empty', '  ', /empty/],
    ['over 40 characters', 'x'.repeat(41), 'At most 40 characters'],
    ['outside the label charset', 'Teide 🌋', /character/],
  ])('refuses a label that is %s', (_, text, message) => {
    refused(tryEdit(T.seed, T, setLabel('hostels', 'adeje-nest', text)), message);
  });

  it('refuses Nest Pass on Ibiza, and allows it on the Canaries', () => {
    refused(tryEdit(IB.seed, IB, setLabel('attractions', 'dalt-vila', 'Nest Pass Dalt Vila')), /Nest Pass/);
    expect(ok(setLabel('attractions', 'teide', 'Nest Pass Teide')).attractions[0]!.label).toBe('Nest Pass Teide');
  });

  it('refuses a row that is not on the map', () => {
    refused(tryEdit(T.seed, T, setLabel('hostels', 'cisne-nest', 'Cisne')), /not on this map/);
  });
});

describe('visibility', () => {
  it('shows and hides any row', () => {
    expect(hostel(ok(setVisible('hostels', 'adeje-nest', false)), 'adeje-nest').visible).toBe(false);
    expect(ok(setVisible('attractions', 'teide', false)).attractions[0]!.visible).toBe(false);
    expect(ok(setVisible('decor', 'teide', false)).decor[0]!.visible).toBe(false);
    expect(ok(setVisible('routes', 'puerto-arena', false)).routes[0]!.visible).toBe(false);
    const back = chain(T, setVisible('hostels', 'adeje-nest', false), setVisible('hostels', 'adeje-nest', true));
    expect(bytes(back)).toBe(bytes(T.seed));
  });
});

describe('coordinates', () => {
  it('moves the point', () => {
    const d = ok(setCoords('hostels', 'adeje-nest', { lat: 28.12, lng: -16.73 }));
    expect(hostel(d, 'adeje-nest')).toMatchObject({ lat: 28.12, lng: -16.73 });
    expect(ok(setCoords('attractions', 'teide', { lat: 28.27, lng: -16.64 })).attractions[0]).toMatchObject({ lat: 28.27, lng: -16.64 });
  });

  it('refuses a point off the artboard, with the paste parser’s own words', () => {
    refused(tryEdit(T.seed, T, setCoords('hostels', 'adeje-nest', { lat: -16.73, lng: 28.12 })), OFF_MAP);
  });

  it('moves a decor icon too', () => {
    expect(ok(setCoords('decor', 'sun', { lat: 28.5, lng: -16.8 })).decor.find((x) => x.id === 'sun')).toMatchObject({ lat: 28.5, lng: -16.8 });
  });

  it('marks a hostel verified, and moving it clears the flag again (decision 13)', () => {
    const verified = ok(markVerified('adeje-nest'));
    expect(hostel(verified, 'adeje-nest').coordsVerified).toBe(true);
    const moved = ok(setCoords('hostels', 'adeje-nest', { lat: 28.12, lng: -16.73 }), T, verified);
    expect(hostel(moved, 'adeje-nest').coordsVerified).toBe(false);
  });

  it('keeps the flag when the coordinates do not change', () => {
    const verified = ok(markVerified('adeje-nest'));
    const { lat, lng } = hostel(verified, 'adeje-nest');
    expect(hostel(ok(setCoords('hostels', 'adeje-nest', { lat, lng }), T, verified), 'adeje-nest').coordsVerified).toBe(true);
  });
});

describe('label side', () => {
  it('sets the side and clears the drag nudge (spec §2)', () => {
    const d = ok(setSide('hostels', 'ashavana-nest', 'below'));
    expect(hostel(d, 'ashavana-nest').labelPlacement).toEqual({ side: 'below', dx: 0, dy: 0 });
  });

  it('does nothing when the side is already chosen, so hand-set nudges survive a stray click', () => {
    expect(hostel(ok(setSide('hostels', 'medano-nest', 'right')), 'medano-nest').labelPlacement).toEqual({ side: 'right', dx: 16, dy: 0 });
  });
});

describe('label nudge (a label drag)', () => {
  it('sets dx and dy in whole pixels and keeps the side', () => {
    const d = ok(setNudge('hostels', 'adeje-nest', { dx: 56.6, dy: -40.4 }));
    expect(hostel(d, 'adeje-nest').labelPlacement).toEqual({ side: 'right', dx: 57, dy: -40 });
    expect(ok(setNudge('attractions', 'teide', { dx: -3, dy: 12 })).attractions[0]!.labelPlacement).toEqual({ side: 'above', dx: -3, dy: 12 });
    // Never −0, which would read back differently from the 0 it writes.
    expect(Object.is(hostel(ok(setNudge('hostels', 'adeje-nest', { dx: -0.4, dy: 5 })), 'adeje-nest').labelPlacement.dx, 0)).toBe(true);
  });

  it('leaves the file as it was when the nudge does not change', () => {
    expect(bytes(ok(setNudge('hostels', 'medano-nest', { dx: 16.2, dy: -0.3 })))).toBe(bytes(T.seed));
  });

  it('refuses a row that is not on the map', () => {
    refused(tryEdit(T.seed, T, setNudge('hostels', 'cisne-nest', { dx: 1, dy: 1 })), /not on this map/);
  });
});

describe('a point from the map (a click or a drag)', () => {
  const p = { x: 612.4, y: 377.9 };
  const near = (island: IslandEntry, item: { lat: number; lng: number }, q: { x: number; y: number }) => {
    const back = at(island, item);
    expect(Math.abs(back.x - q.x)).toBeLessThan(0.01);
    expect(Math.abs(back.y - q.y)).toBeLessThan(0.01);
    // 5 decimals, as every point made on the map.
    expect(item.lat).toBe(Math.round(item.lat * 1e5) / 1e5);
    expect(item.lng).toBe(Math.round(item.lng * 1e5) / 1e5);
  };

  it('adds a spot or an icon where the map was clicked', () => {
    near(T, ok(addAttraction(p)).attractions.at(-1)!, p);
    near(T, ok(addDecor(p)).decor.at(-1)!, p);
  });

  it('adds a missing hostel where the map was clicked: its seed label and label placement, unverified', () => {
    const verifiedSeed: IslandEntry = { ...T, seed: { ...T.seed, hostels: T.seed.hostels.map((h) => ({ ...h, coordsVerified: true })) } };
    const d = ok(addHostel('adeje-nest', p), verifiedSeed, chain(verifiedSeed, remove('hostels', 'adeje-nest')));
    const h = hostel(d, 'adeje-nest');
    near(T, h, p);
    expect(h).toMatchObject({ label: 'Adeje', coordsVerified: false, visible: true });
    expect(h.labelPlacement).toEqual(hostel(T.seed, 'adeje-nest').labelPlacement);
  });

  it('moves a decor icon, a spot or a hostel there; a moved hostel is unverified again (decision 13)', () => {
    near(T, ok(placeAt('decor', 'sun', p)).decor.find((x) => x.id === 'sun')!, p);
    near(T, ok(placeAt('attractions', 'teide', p)).attractions[0]!, p);
    const moved = hostel(ok(placeAt('hostels', 'puerto-nest', p), T, ok(markVerified('puerto-nest'))), 'puerto-nest');
    near(T, moved, p);
    expect(moved.coordsVerified).toBe(false);
  });

  it('keeps the flag when the point does not move', () => {
    const verified = ok(markVerified('puerto-nest'));
    const same = ok(placeAt('hostels', 'puerto-nest', at(T, hostel(verified, 'puerto-nest'))), T, verified);
    expect(hostel(same, 'puerto-nest').coordsVerified).toBe(true);
  });

  it('keeps a point dragged off the artboard on its edge', () => {
    const sun = ok(placeAt('decor', 'sun', { x: -100, y: 540 })).decor.find((x) => x.id === 'sun')!;
    expect(at(T, sun).x).toBeCloseTo(0.5, 1);
  });

  it('refuses a row that is not on the map', () => {
    refused(tryEdit(T.seed, T, placeAt('decor', 'nope', p)), /not on this map/);
  });
});

describe('removing and adding hostels (decision 3)', () => {
  it('removes a hostel together with its routes, and says so', () => {
    const r = tryEdit(T.seed, T, remove('hostels', 'puerto-nest'));
    expect(r.ok && r.data.routes).toEqual([]);
    expect(r.ok && r.note).toBe('Removed, with 1 route');
    valid(r.ok ? r.data : T.seed);
  });

  it('removes a hostel without routes quietly', () => {
    const r = tryEdit(T.seed, T, remove('hostels', 'adeje-nest'));
    expect(r.ok && r.data.hostels.map((h) => h.slug)).not.toContain('adeje-nest');
    expect(r.ok && r.data.routes).toEqual(T.seed.routes);
    expect(r.ok && r.note).toBeUndefined();
  });

  it('offers only the island’s real hostels that are not on the map', () => {
    expect(missingHostels(T.seed, T)).toEqual([]);
    const d = chain(T, remove('hostels', 'adeje-nest'), remove('hostels', 'aguere-nest'));
    expect(missingHostels(d, T).map((h) => h.name)).toEqual(['Adeje Nest', 'Aguere Nest']);
  });

  it('puts a removed hostel back as the seed had it: remove + add gives the seed bytes', () => {
    const d = chain(T, remove('hostels', 'adeje-nest'), addHostel('adeje-nest'));
    expect(bytes(d)).toBe(bytes(T.seed));
  });

  it('keeps the seed order when hostels come back', () => {
    const d = chain(T, remove('hostels', 'aguere-nest'), remove('hostels', 'duque-nest'), addHostel('duque-nest'));
    expect(d.hostels.map((h) => h.slug)).toEqual(T.seed.hostels.map((h) => h.slug).filter((s) => s !== 'aguere-nest'));
  });

  it('never invents a hostel: only canonical, absent hostels of this island', () => {
    refused(tryEdit(T.seed, T, addHostel('adeje-nest')), /already on the map/);
    refused(tryEdit(T.seed, T, addHostel('cisne-nest')), /not a Tenerife hostel/);
    refused(tryEdit(T.seed, T, addHostel('new-nest')), /not a Tenerife hostel/);
  });

  it('places a canonical hostel the seed lacks at the centre, under its real name', () => {
    const island: IslandEntry = { ...T, seed: { ...T.seed, hostels: T.seed.hostels.filter((h) => h.slug !== 'adeje-nest') } };
    const d = ok(addHostel('adeje-nest'), island);
    const h = d.hostels.at(-1)!;
    expect(h).toMatchObject({ slug: 'adeje-nest', label: 'Adeje Nest', coordsVerified: false, visible: true });
    expect(h.labelPlacement).toEqual({ side: 'below', dx: 0, dy: 0 });
    const p = at(T, h);
    expect(Math.abs(p.x - 540)).toBeLessThan(1);
    expect(Math.abs(p.y - 540)).toBeLessThan(1);
  });
});

describe('things to do', () => {
  it('adds a spot at the artboard centre, unprojected (spec §2), as the prototype did', () => {
    const d = ok(addAttraction());
    const a = d.attractions.at(-1)!;
    expect(a).toMatchObject({ id: 'new-spot', label: 'New spot', icon: 'star', visible: true });
    expect(a.labelPlacement).toEqual({ side: 'below', dx: 0, dy: 0 });
    const p = at(T, a);
    expect(Math.abs(p.x - 540)).toBeLessThan(1);
    expect(Math.abs(p.y - 540)).toBeLessThan(1);
    // 5 decimals: about a metre, far finer than a pixel.
    expect(a.lat).toBe(Math.round(a.lat * 1e5) / 1e5);
    expect(a.lng).toBe(Math.round(a.lng * 1e5) / 1e5);
  });

  it('gives each new spot its own id', () => {
    const d = chain(T, addAttraction(), addAttraction(), addAttraction());
    expect(d.attractions.slice(-3).map((a) => a.id)).toEqual(['new-spot', 'new-spot-2', 'new-spot-3']);
  });

  it('changes the icon of a spot or a decor icon', () => {
    expect(ok(setIcon('attractions', 'teide', 'peak')).attractions[0]!.icon).toBe('peak');
    expect(ok(setIcon('decor', 'sun', 'sunset')).decor.find((x) => x.id === 'sun')!.icon).toBe('sunset');
  });

  it('removes a spot', () => {
    expect(ok(remove('attractions', 'teide')).attractions.map((a) => a.id)).not.toContain('teide');
  });
});

describe('decor', () => {
  it('adds an icon at the centre, named after it as the seeds are', () => {
    const d = ok(addDecor());
    const icon = d.decor.at(-1)!;
    expect(icon).toMatchObject({ id: 'sun-2', icon: 'sun', size: 40, showOn: 'both', visible: true });
    expect(icon.lat).toBe(Math.round(icon.lat * 1e5) / 1e5);
    expect(icon.lng).toBe(Math.round(icon.lng * 1e5) / 1e5);
    expect(ok(addDecor(), IB, { ...IB.seed, decor: [] }).decor[0]!.id).toBe('sun');
  });

  it('sizes an icon from 20 to 140, in whole pixels', () => {
    const size = (n: number) => ok(setDecorSize('sun', n)).decor.find((x) => x.id === 'sun')!.size;
    expect(size(61.4)).toBe(61);
    expect(size(20)).toBe(20);
    expect(size(140)).toBe(140);
    expect(size(19.6)).toBe(20);
    refused(tryEdit(T.seed, T, setDecorSize('sun', 19)), /20.*140/);
    refused(tryEdit(T.seed, T, setDecorSize('sun', 141)), /20.*140/);
  });

  it('cycles Show on: Both maps → Hostels → Things to do → Both maps', () => {
    const showOn = (d: IslandData) => d.decor.find((x) => x.id === 'sun')!.showOn;
    let d = T.seed;
    const seen = [showOn(d)];
    for (let i = 0; i < 3; i++) seen.push(showOn((d = ok(cycleShowOn('decor', 'sun'), T, d))));
    expect(seen).toEqual(['both', 'hostels', 'attractions', 'both']);
    expect(route(ok(cycleShowOn('routes', 'puerto-arena')), 'puerto-arena').showOn).toBe('attractions');
  });

  it('removes an icon', () => {
    expect(ok(remove('decor', 'sun')).decor.map((x) => x.id)).not.toContain('sun');
  });
});

describe('routes', () => {
  it('joins the first two visible hostels, as the prototype did', () => {
    const d = ok(addRoute());
    expect(d.routes.at(-1)).toEqual({ id: 'aguere-puerto', from: 'aguere-nest', to: 'puerto-nest', bend: 0.2, showOn: 'hostels', visible: true });
    expect(chain(T, addRoute(), addRoute()).routes.at(-1)!.id).toBe('aguere-puerto-2');
    const hidden = ok(addRoute(), T, ok(setVisible('hostels', 'aguere-nest', false)));
    expect(hidden.routes.at(-1)).toMatchObject({ from: 'puerto-nest', to: 'las-eras-nest' });
  });

  it('needs two visible hostels', () => {
    const one = ok(setVisible('hostels', 'flamingo-nest', false), IB);
    refused(tryEdit(one, IB, addRoute()), 'A route needs two hostels on this island');
    const empty: IslandData = { ...GC.seed, hostels: [] };
    refused(tryEdit(empty, GC, addRoute()), 'A route needs two hostels on this island');
  });

  it('cycles an end through the visible hostels, skipping the other end', () => {
    expect(route(ok(cycleRouteEnd('puerto-arena', 'from')), 'puerto-arena').from).toBe('las-eras-nest');
    expect(route(ok(cycleRouteEnd('puerto-arena', 'to')), 'puerto-arena').to).toBe('adeje-nest');
    const hidden = ok(setVisible('hostels', 'las-eras-nest', false));
    expect(route(ok(cycleRouteEnd('puerto-arena', 'from'), T, hidden), 'puerto-arena').from).toBe('adeje-nest');
  });

  it('never lets the two ends meet, all the way round', () => {
    let d = T.seed;
    const froms = [];
    for (let i = 0; i < 12; i++) {
      d = ok(cycleRouteEnd('puerto-arena', 'from'), T, d);
      const r = route(d, 'puerto-arena');
      expect(r.from).not.toBe(r.to);
      froms.push(r.from);
    }
    // Eight other hostels, in data order, then round again.
    expect(new Set(froms).size).toBe(8);
  });

  it('refuses to cycle when no other visible hostel is left, and says what would help', () => {
    refused(tryEdit(IB.seed, IB, cycleRouteEnd('cisne-flamingo', 'to')), 'No other Ibiza hostel to change it to');
    const twoShown = T.seed.hostels.filter((h) => h.slug !== 'puerto-nest' && h.slug !== 'arena-nest').map((h) => setVisible('hostels', h.slug, false));
    refused(tryEdit(chain(T, ...twoShown), T, cycleRouteEnd('puerto-arena', 'from')), 'Show another hostel to change this end');
  });

  it('bends from -1 to 1, to 2 decimals', () => {
    const bend = (b: number) => route(ok(setBend('puerto-arena', b)), 'puerto-arena').bend;
    expect(bend(-0.35000001)).toBe(-0.35);
    expect(bend(-1)).toBe(-1);
    expect(bend(1)).toBe(1);
    refused(tryEdit(T.seed, T, setBend('puerto-arena', 1.5)), /-1.*1/);
  });

  it('removes a route', () => {
    expect(ok(remove('routes', 'puerto-arena')).routes).toEqual([]);
  });
});

describe('settings', () => {
  it('patches the island’s settings, shared by both its maps', () => {
    expect(ok(setSettings({ palette: 'brandTeal', rings: 2 })).settings).toMatchObject({ palette: 'brandTeal', rings: 2, labelSize: 25 });
  });

  it('rounds slider values before they reach the file', () => {
    const s = ok(setSettings({ labelSize: 25.4, labelTracking: 0.12300000001, pinSize: 0.94999999 })).settings;
    expect(s).toMatchObject({ labelSize: 25, labelTracking: 0.12, pinSize: 0.95 });
  });

  it('rounds only what the patch changes', () => {
    const fine: IslandData = { ...T.seed, settings: { ...T.seed.settings, labelTracking: 0.123 } };
    expect(ok(setSettings({ palette: 'brandTeal' }), T, fine).settings.labelTracking).toBe(0.123);
  });

  it.each([{ labelSize: 40 }, { rings: 5 }, { pinSize: 2 }, { labelTracking: -0.1 }])('refuses %o', (patch) => {
    expect(tryEdit(T.seed, T, setSettings(patch)).ok).toBe(false);
  });
});

describe('reset and import', () => {
  it('reset restores the published seed', () => {
    const edited = chain(T, setLabel('hostels', 'adeje-nest', 'Adeje Beach'), setSettings({ rings: 1 }), addDecor());
    expect(bytes(ok(resetIsland(), T, edited))).toBe(bytes(T.seed));
  });

  it('import round-trips a downloaded file', () => {
    const edited = chain(T, setLabel('hostels', 'adeje-nest', 'Adeje Beach'), addRoute(), setSettings({ palette: 'brandTeal' }));
    const file = JSON.parse(bytes(edited));
    expect(bytes(ok(importFile(file)))).toBe(bytes(edited));
  });

  it('import refuses another island’s file and broken data, with the reason', () => {
    refused(tryEdit(T.seed, T, importFile(JSON.parse(bytes(IB.seed, IB)))), /Ibiza/);
    const broken = JSON.parse(bytes(T.seed));
    broken.hostels[0].lat = 'north';
    refused(tryEdit(T.seed, T, importFile(broken)), /hostels\.0\.lat/);
  });
});

describe('every edit keeps the file valid', () => {
  it('through a long mixed session on every island', () => {
    const script: [IslandEntry, IslandEdit][] = [
      [T, setLabel('hostels', 'medano-nest', 'El Médano')],
      [T, remove('hostels', 'arena-nest')],
      [T, addRoute()],
      [T, cycleRouteEnd('aguere-puerto', 'to')],
      [T, setVisible('hostels', 'aguere-nest', false)],
      [T, cycleRouteEnd('aguere-puerto', 'from')],
      [T, addHostel('arena-nest')],
      [T, addAttraction()],
      [T, setLabel('attractions', 'new-spot', 'Playa Jardín')],
      [T, setCoords('attractions', 'new-spot', { lat: 28.41, lng: -16.56 })],
      [T, addDecor()],
      [T, setDecorSize('sun-2', 90)],
      [T, setSettings({ labelFont: 'poppins', labelStyle: 'text', pinStyle: 'dot', showIcons: false })],
      [GC, remove('hostels', 'pura-vida-nest')],
      [GC, addRoute()],
      [GC, setBend('la-isleta-las-palmas', -1)],
      [GC, addHostel('pura-vida-nest')],
      [IB, setLabel('hostels', 'cisne-nest', 'Cisne')],
      [IB, remove('hostels', 'flamingo-nest')],
      [IB, addHostel('flamingo-nest')],
      [IB, addRoute()],
      [IB, setSide('attractions', 'es-vedra', 'left')],
      [IB, setNudge('attractions', 'es-vedra', { dx: -30.4, dy: 18.6 })],
      [IB, placeAt('decor', 'sun', { x: 1200, y: -5 })],
      [IB, addAttraction({ x: 400, y: 610 })],
      [GC, addDecor({ x: 20, y: 1060 })],
      [GC, placeAt('hostels', 'pura-vida-nest', { x: 560, y: 480 })],
      [T, remove('hostels', 'adeje-nest')],
      [T, addHostel('adeje-nest', { x: 300, y: 650 })],
    ];
    let ws = seedWorkspace();
    for (const [island, edit] of script) {
      const before = ws;
      ws = applyEdit(ws, island, edit);
      expect(ws, `${island.id}: an edit in the script was refused`).not.toBe(before);
      for (const d of Object.values(ws)) valid(d);
    }
    expect(ws.tenerife.routes.map((r) => r.id)).toEqual(['aguere-puerto']);
  });
});
