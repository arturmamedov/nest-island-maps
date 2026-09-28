import { OFF_MAP, onArtboard } from '../shared/coords';
import { issueText, parseDataFile } from '../shared/datafile';
import { unproject } from '../shared/geo';
import type { IconId } from '../shared/icons';
import type { IslandEntry } from '../shared/islands';
import {
  canonicalHostels,
  IslandDataSchema,
  parseLabel,
  SettingsSchema,
  SHOW_ON,
  type Attraction,
  type CanonicalHostel,
  type Decor,
  type Hostel,
  type IslandData,
  type LabelPlacement,
  type Route,
  type Settings,
  type Side,
} from '../shared/schema';
import { ARTBOARD, DECOR_SIZE, ROUTE_BEND } from '../shared/tokens';
import type { Workspace } from './workspace';

/* The editor's edits (spec §2 "Interactions") as pure functions: each takes
   one island's data and returns new data, or a refusal staff can read. Every
   result then goes through IslandDataSchema before it is kept (tryEdit), so
   the list can never hold a file that the seeds, the draft or an import would
   refuse, and the data stays in the file's key order: Download JSON is always
   seed-shaped. The island (name, geometry, seed) is passed in rather than
   looked up, so the tests can hand in a different seed. */

export type EditResult = { ok: true; data: IslandData; note?: string } | { ok: false; error: string };
export type IslandEdit = (data: IslandData, island: IslandEntry) => EditResult;

type Items = { hostels: Hostel; attractions: Attraction; decor: Decor; routes: Route };
export type Collection = keyof Items;
/** The rows drawn as points with labels: hostels on one map, things to do on the other. */
export type PointKind = 'hostels' | 'attractions';

/** The prototype's message, kept word for word. */
export const ROUTE_NEEDS_TWO = 'A route needs two hostels on this island';
/** What "+ Add row", "+ Add icon" and "+ Add route" start from: the prototype's defaults. */
export const NEW_SPOT = { label: 'New spot', icon: 'star' } as const satisfies Pick<Attraction, 'label' | 'icon'>;
export const NEW_DECOR = { icon: 'sun', size: 40, showOn: 'both' } as const satisfies Pick<Decor, 'icon' | 'size' | 'showOn'>;
export const NEW_ROUTE = { bend: 0.2, showOn: 'hostels' } as const satisfies Pick<Route, 'bend' | 'showOn'>;

const done = (data: IslandData, note?: string): EditResult => (note ? { ok: true, data, note } : { ok: true, data });
const refuse = (error: string): EditResult => ({ ok: false, error });
const notOnMap = (key: string) => refuse(`"${key}" is not on this map`);

/** Runs an edit, then holds the result to the schema; a refusal changes nothing. */
export function tryEdit(data: IslandData, island: IslandEntry, edit: IslandEdit): EditResult {
  const r = edit(data, island);
  if (!r.ok) return r;
  const checked = IslandDataSchema.safeParse(r.data);
  if (!checked.success) return refuse(issueText(checked.error.issues[0]!));
  // Keep the parse output: the file's key order and normalised labels, exactly as a seed has them.
  const { artboard: _artboard, projection: _projection, ...clean } = checked.data;
  return done(clean, r.note);
}

/** The workspace with one island edited, or the same workspace when the edit is refused. */
export function applyEdit(ws: Workspace, island: IslandEntry, edit: IslandEdit): Workspace {
  const r = tryEdit(ws[island.id], island, edit);
  return r.ok ? { ...ws, [island.id]: r.data } : ws;
}

const keyOf = (item: Items[Collection]) => ('slug' in item ? item.slug : item.id);

/** One row changed in place; `change` returns the new row, or why it can't. */
function update<C extends Collection>(
  collection: C,
  key: string,
  change: (item: Items[C], data: IslandData, island: IslandEntry) => Items[C] | string,
): IslandEdit {
  return (data, island) => {
    const list = data[collection] as Items[C][];
    const i = list.findIndex((item) => keyOf(item) === key);
    if (i < 0) return notOnMap(key);
    const next = change(list[i]!, data, island);
    return typeof next === 'string' ? refuse(next) : done({ ...data, [collection]: list.with(i, next) });
  };
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const below = (): LabelPlacement => ({ side: 'below', dx: 0, dy: 0 });

/** The artboard centre on the map (spec §2 "+ Add row"), to 5 decimals: about a metre, where a pixel is over 100 m. */
function centre(island: IslandEntry) {
  const { lat, lng } = unproject(island.geometry.projection, ARTBOARD / 2, ARTBOARD / 2);
  return { lat: round(lat, 5), lng: round(lng, 5) };
}

/* Ids are set once, at creation: they are the row's identity and, prefixed by
   the layout (spot-, decor-, route-), Figma's layer names. Renaming a row or
   cycling a route's ends never changes them. */
function uniqueId(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`;
}

// Points: hostels and things to do.

export const setLabel = (kind: PointKind, key: string, text: string): IslandEdit =>
  update(kind, key, (item, data) => {
    const r = parseLabel(text, data.island);
    return r.ok ? { ...item, label: r.label } : r.error;
  });

export const setVisible = (collection: Collection, key: string, visible: boolean): IslandEdit =>
  update(collection, key, (item) => ({ ...item, visible }));

/** Refuses points off the artboard, by the paste parser's own rule. */
export const setCoords = (kind: PointKind, key: string, at: { lat: number; lng: number }): IslandEdit =>
  update(kind, key, (item, _data, island) => {
    if (!onArtboard(island.geometry.projection, at.lat, at.lng)) return OFF_MAP;
    if (item.lat === at.lat && item.lng === at.lng) return item;
    const moved = { ...item, lat: at.lat, lng: at.lng };
    // Decision 13: a moved pin is no longer the one the owner confirmed.
    return 'coordsVerified' in moved ? { ...moved, coordsVerified: false } : moved;
  });

/** What a click on the unverified badge does (decision 13). */
export const markVerified = (slug: string): IslandEdit => update('hostels', slug, (h) => ({ ...h, coordsVerified: true }));

/** A new side clears the drag nudge (spec §2); the side already chosen changes nothing, so a stray click keeps hand-set nudges. */
export const setSide = (kind: PointKind, key: string, side: Side): IslandEdit =>
  update(kind, key, (item) => (item.labelPlacement.side === side ? item : { ...item, labelPlacement: { side, dx: 0, dy: 0 } }));

/** Removing a hostel also removes its routes (decision 3), and the note says so. */
export const remove =
  (collection: Collection, key: string): IslandEdit =>
  (data) => {
    const list: readonly Items[Collection][] = data[collection];
    if (!list.some((item) => keyOf(item) === key)) return notOnMap(key);
    const next = { ...data, [collection]: list.filter((item) => keyOf(item) !== key) };
    if (collection !== 'hostels') return done(next);
    const routes = data.routes.filter((r) => r.from !== key && r.to !== key);
    const dropped = data.routes.length - routes.length;
    return done({ ...next, routes }, dropped ? `Removed, with ${dropped} route${dropped === 1 ? '' : 's'}` : undefined);
  };

/** The island's real hostels that are not on the map: all "+ Add hostel" may offer. */
export const missingHostels = (data: IslandData, island: IslandEntry): CanonicalHostel[] =>
  canonicalHostels(island.id).filter((h) => !data.hostels.some((x) => x.slug === h.slug));

/* Decision 3: only a real hostel of this island, and back as the seed had it,
   in its seed place, so removing and re-adding one leaves no diff. A hostel
   the seed doesn't have yet (after a future sync:hostels) starts at the
   centre under its canonical name: a real name, never an invented one. */
export const addHostel =
  (slug: string): IslandEdit =>
  (data, island) => {
    const canonical = canonicalHostels(island.id).find((h) => h.slug === slug);
    if (!canonical) return refuse(`${slug} is not a ${island.name} hostel`);
    if (data.hostels.some((h) => h.slug === slug)) return refuse(`${canonical.name} is already on the map`);

    let hostel = island.seed.hostels.find((h) => h.slug === slug);
    if (!hostel) {
      const label = parseLabel(canonical.name, island.id);
      if (!label.ok) return refuse(`${canonical.name}: ${label.error}`);
      hostel = { slug, label: label.label, ...centre(island), coordsVerified: false, labelPlacement: below(), visible: true };
    }

    const seedOrder = island.seed.hostels.map((h) => h.slug);
    const rank = (s: string) => (seedOrder.includes(s) ? seedOrder.indexOf(s) : Infinity);
    const i = data.hostels.findIndex((h) => rank(h.slug) > rank(slug));
    return done({ ...data, hostels: i < 0 ? [...data.hostels, hostel] : data.hostels.toSpliced(i, 0, hostel) });
  };

/** "+ Add row" on Things to do: a "New spot" at the artboard centre. */
export const addAttraction =
  (): IslandEdit =>
  (data, island) => {
    const id = uniqueId('new-spot', data.attractions.map((a) => a.id));
    const spot: Attraction = { id, label: NEW_SPOT.label, ...centre(island), icon: NEW_SPOT.icon, labelPlacement: below(), visible: true };
    return done({ ...data, attractions: [...data.attractions, spot] });
  };

export const setIcon = (collection: 'attractions' | 'decor', id: string, icon: IconId): IslandEdit =>
  update(collection, id, (item) => ({ ...item, icon }));

// Decor.

export const setDecorSize = (id: string, size: number): IslandEdit =>
  update('decor', id, (d) => {
    const n = Math.round(size);
    return n >= DECOR_SIZE.min && n <= DECOR_SIZE.max ? { ...d, size: n } : `Size runs from ${DECOR_SIZE.min} to ${DECOR_SIZE.max}`;
  });

/** Both maps → Hostels → Things to do → Both maps. */
export const cycleShowOn = (collection: 'decor' | 'routes', id: string): IslandEdit =>
  update(collection, id, (item) => ({ ...item, showOn: SHOW_ON[(SHOW_ON.indexOf(item.showOn) + 1) % SHOW_ON.length]! }));

/** "+ Add icon": named after its icon, as the seed decor is (sun, sun-2…). */
export const addDecor =
  (): IslandEdit =>
  (data, island) => {
    const id = uniqueId(NEW_DECOR.icon, data.decor.map((d) => d.id));
    return done({ ...data, decor: [...data.decor, { id, icon: NEW_DECOR.icon, ...centre(island), size: NEW_DECOR.size, showOn: NEW_DECOR.showOn, visible: true }] });
  };

// Routes.

const shortName = (slug: string) => slug.replace(/-nest$/, '');

/** "+ Add route": between the first two visible hostels, named after them as the seed routes are (puerto-arena). */
export const addRoute =
  (): IslandEdit =>
  (data) => {
    const [from, to] = data.hostels.filter((h) => h.visible);
    if (!from || !to) return refuse(ROUTE_NEEDS_TWO);
    const id = uniqueId(`${shortName(from.slug)}-${shortName(to.slug)}`, data.routes.map((r) => r.id));
    return done({ ...data, routes: [...data.routes, { id, from: from.slug, to: to.slug, ...NEW_ROUTE, visible: true }] });
  };

/* One click moves an end to the next visible hostel in list order, wrapping
   round and stepping over the other end, so the two never meet. The
   prototype cycled every hostel and allowed a route onto itself. */
export const cycleRouteEnd = (id: string, end: 'from' | 'to'): IslandEdit =>
  update('routes', id, (r, data, island) => {
    const other = end === 'from' ? r.to : r.from;
    const start = data.hostels.findIndex((h) => h.slug === r[end]);
    for (let step = 1; step < data.hostels.length; step++) {
      const h = data.hostels[(start + step) % data.hostels.length]!;
      if (h.visible && h.slug !== other) return end === 'from' ? { ...r, from: h.slug } : { ...r, to: h.slug };
    }
    if (data.hostels.filter((h) => h.visible).length < 2) return ROUTE_NEEDS_TWO;
    return data.hostels.some((h) => !h.visible) ? 'Show another hostel to change this end' : `No other ${island.name} hostel to change it to`;
  });

export const setBend = (id: string, bend: number): IslandEdit =>
  update('routes', id, (r) => {
    const b = round(bend, 2);
    return b >= ROUTE_BEND.min && b <= ROUTE_BEND.max ? { ...r, bend: b } : `Bend runs from ${ROUTE_BEND.min} to ${ROUTE_BEND.max}`;
  });

// The whole island.

/** Decimal places kept for each slider setting: they reach the committed file, so keep what the slider means. */
const SLIDER_PLACES = { labelSize: 0, labelTracking: 2, pinSize: 2 } as const;

/** Settings belong to the island file and are shared by its two maps. Only the patched values are rounded. */
export const setSettings =
  (patch: Partial<Settings>): IslandEdit =>
  (data) => {
    const rounded = { ...patch };
    for (const [key, places] of Object.entries(SLIDER_PLACES) as [keyof typeof SLIDER_PLACES, number][]) {
      const v = rounded[key];
      if (v !== undefined) rounded[key] = round(v, places);
    }
    const r = SettingsSchema.safeParse({ ...data.settings, ...rounded });
    return r.success ? done({ ...data, settings: r.data }) : refuse(issueText(r.error.issues[0]!));
  };

/** Reset island: the published seed again. */
export const resetIsland = (): IslandEdit => (_data, island) => done(island.seed);

/** Import JSON: the file replaces the island, if it is this island's and valid. */
export const importFile =
  (json: unknown): IslandEdit =>
  (_data, island) => {
    const r = parseDataFile(json, island);
    return r.ok ? done(r.data) : refuse(r.error);
  };
