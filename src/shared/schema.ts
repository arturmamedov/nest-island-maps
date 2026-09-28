import { z } from 'zod';
import hostelsFile from '../../data/hostels.json';
import iconsFile from '../../data/icons.json';
import { ISLAND_IDS, LAYERS, SHOW_ON } from './ids.js';
import {
  ARTBOARD,
  DECOR_SIZE,
  LABEL_CHARSET,
  LABEL_FONT_IDS,
  LABEL_MAX,
  LABEL_SIZE,
  LABEL_TRACKING,
  NEST_PASS,
  PALETTE_IDS,
  PIN_SIZE,
  RING_COUNT,
  ROUTE_BEND,
} from './tokens.js';

/* The source of truth for every island file (handoff README §3): the seeds,
   the autosaved draft and imported JSON all pass through IslandDataSchema.
   `npm run gen` derives schema/*.schema.json from here for the WordPress
   theme. The refinements (hostel ↔ island, unique ids, route endpoints, the
   Ibiza firewall) cannot be expressed in JSON Schema and only live here. */

export { ISLAND_IDS, LAYERS, SHOW_ON };
export const IslandIdSchema = z.enum(ISLAND_IDS);
export type IslandId = z.infer<typeof IslandIdSchema>;
export type Layer = (typeof LAYERS)[number];

export const SIDES = ['below', 'above', 'right', 'left'] as const;
export type Side = (typeof SIDES)[number];
export type ShowOn = (typeof SHOW_ON)[number];
export const LABEL_STYLES = ['accent', 'white', 'dark', 'text'] as const;
export type LabelStyle = (typeof LABEL_STYLES)[number];
export const PIN_STYLES = ['pin', 'dot'] as const;
export type PinStyle = (typeof PIN_STYLES)[number];

type IconId = keyof typeof iconsFile.icons;
export const ICON_IDS = Object.keys(iconsFile.icons) as [IconId, ...IconId[]];
export const IconIdSchema = z.enum(ICON_IDS);

/* Hostel identity comes from the flyers repo (data/hostels.json is derived
   from it): a map can only carry real hostels, never invented ones. */
const HOSTEL_SLUGS = hostelsFile.hostels.map((h) => h.slug) as [string, ...string[]];
const HOSTEL_ISLAND = new Map(hostelsFile.hostels.map((h) => [h.slug, h.island]));
export const HostelSlugSchema = z.enum(HOSTEL_SLUGS);

export type CanonicalHostel = { slug: string; name: string; island: IslandId };
/** Every real hostel, in data/hostels.json order: the only ones "+ Add hostel" may offer. */
export const CANONICAL_HOSTELS: readonly CanonicalHostel[] = z
  .array(z.object({ slug: HostelSlugSchema, name: z.string().min(1), island: IslandIdSchema }))
  .parse(hostelsFile.hostels);

/** The real hostels of one island. */
export const canonicalHostels = (island: IslandId): CanonicalHostel[] => CANONICAL_HOSTELS.filter((h) => h.island === island);

const id = z.string().regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, digits and dashes');
/** A map label: stored as typed (mixed case) and uppercased in JS at render.
    NFC, because a pasted "é" can arrive as e + a combining accent the fonts do not carry. */
export const LabelSchema = z
  .string()
  .trim()
  .normalize()
  .min(1, 'A label cannot be empty')
  .max(LABEL_MAX, `At most ${LABEL_MAX} characters`)
  .regex(LABEL_CHARSET, 'Uses a character the label fonts cannot draw');

const NEST_PASS_MESSAGE = 'Nest Pass content is not allowed on an Ibiza map';
/** The Ibiza firewall (CLAUDE.md): the islands where no Nest Pass content may appear. */
const firewalled = (island: IslandId) => island === 'ibiza';

export type LabelResult = { ok: true; label: string } | { ok: false; error: string };

/* The row input and the edits both ask this, so a label the list accepts is
   exactly one the file accepts: the label rule plus the Ibiza firewall. */
/** Checks one label for an island; `label` is the trimmed, NFC form to store. */
export function parseLabel(text: string, island: IslandId): LabelResult {
  const r = LabelSchema.safeParse(text);
  if (!r.success) return { ok: false, error: r.error.issues[0]!.message };
  if (firewalled(island) && NEST_PASS.test(r.data)) return { ok: false, error: NEST_PASS_MESSAGE };
  return { ok: true, label: r.data };
}
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const LabelPlacementSchema = z.object({
  side: z.enum(SIDES),
  /** Free nudge in artboard px, set by dragging the label. */
  dx: z.number(),
  dy: z.number(),
});
export type LabelPlacement = z.infer<typeof LabelPlacementSchema>;

export const HostelSchema = z.object({
  slug: HostelSlugSchema,
  /** The short map label ("El Duque" for duque-nest). */
  label: LabelSchema,
  lat,
  lng,
  /** False until the owner replaces the approximation with the property's real map pin. */
  coordsVerified: z.boolean(),
  labelPlacement: LabelPlacementSchema,
  visible: z.boolean(),
});
export type Hostel = z.infer<typeof HostelSchema>;

export const AttractionSchema = z.object({
  id,
  label: LabelSchema,
  lat,
  lng,
  icon: IconIdSchema,
  labelPlacement: LabelPlacementSchema,
  visible: z.boolean(),
});
export type Attraction = z.infer<typeof AttractionSchema>;

export const DecorSchema = z.object({
  id,
  icon: IconIdSchema,
  lat,
  lng,
  size: z.number().min(DECOR_SIZE.min).max(DECOR_SIZE.max),
  showOn: z.enum(SHOW_ON),
  visible: z.boolean(),
});
export type Decor = z.infer<typeof DecorSchema>;

export const RouteSchema = z.object({
  id,
  from: HostelSlugSchema,
  to: HostelSlugSchema,
  /** −1…1: how far the quadratic's control point leaves the straight line. */
  bend: z.number().min(ROUTE_BEND.min).max(ROUTE_BEND.max),
  showOn: z.enum(SHOW_ON),
  visible: z.boolean(),
});
export type Route = z.infer<typeof RouteSchema>;

/* One settings object per island file, shared by its two maps, so a saved
   file reproduces both maps exactly. The preview background is a viewer
   preference and never part of the map. */
export const SettingsSchema = z.object({
  palette: z.enum(PALETTE_IDS).default('original'),
  labelFont: z.enum(LABEL_FONT_IDS).default('robotoCondensed'),
  labelSize: z.number().min(LABEL_SIZE.min).max(LABEL_SIZE.max).default(LABEL_SIZE.default),
  labelTracking: z.number().min(LABEL_TRACKING.min).max(LABEL_TRACKING.max).default(LABEL_TRACKING.default),
  labelStyle: z.enum(LABEL_STYLES).default('accent'),
  pinStyle: z.enum(PIN_STYLES).default('pin'),
  pinSize: z.number().min(PIN_SIZE.min).max(PIN_SIZE.max).default(PIN_SIZE.default),
  /** Show only the innermost n halo rings. */
  rings: z.number().int().min(0).max(RING_COUNT).default(RING_COUNT),
  /** Decor icons and dotted routes. */
  showIcons: z.boolean().default(true),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

export const ArtboardSchema = z.tuple([z.literal(ARTBOARD), z.literal(ARTBOARD)]);

export const ProjectionSchema = z.object({
  type: z.literal('mercator'),
  s: z.number().positive(),
  lamC: z.number(),
  mC: z.number(),
  cx: z.number(),
  cy: z.number(),
  note: z.string().optional(),
});
export type Projection = z.infer<typeof ProjectionSchema>;

const IslandDataObject = z.object({
  island: IslandIdSchema,
  name: z.string().min(1),
  /* Written on export so the WordPress theme can place pins with the same
     formula. Copies of the geometry file's values; the app never reads them. */
  artboard: ArtboardSchema.optional(),
  projection: ProjectionSchema.optional(),
  hostels: z.array(HostelSchema),
  attractions: z.array(AttractionSchema),
  decor: z.array(DecorSchema),
  routes: z.array(RouteSchema),
  // prefault, not default: a missing object must still get each field's default.
  settings: SettingsSchema.prefault({}),
});

type Ctx = z.RefinementCtx;

function noDuplicates(items: readonly Record<string, unknown>[], key: string, collection: string, ctx: Ctx) {
  const seen = new Set<unknown>();
  items.forEach((item, i) => {
    const value = item[key];
    if (seen.has(value)) ctx.addIssue({ code: 'custom', path: [collection, i, key], message: `"${String(value)}" appears twice in ${collection}` });
    seen.add(value);
  });
}

function nestPassStrings(value: unknown, path: (string | number)[], ctx: Ctx) {
  if (typeof value === 'string') {
    if (NEST_PASS.test(value)) ctx.addIssue({ code: 'custom', path, message: NEST_PASS_MESSAGE });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => nestPassStrings(v, [...path, i], ctx));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) nestPassStrings(v, [...path, k], ctx);
  }
}

export const IslandDataSchema = IslandDataObject.superRefine((d, ctx) => {
  d.hostels.forEach((h, i) => {
    if (HOSTEL_ISLAND.get(h.slug) !== d.island) {
      ctx.addIssue({ code: 'custom', path: ['hostels', i, 'slug'], message: `${h.slug} is not a ${d.name} hostel` });
    }
  });
  noDuplicates(d.hostels, 'slug', 'hostels', ctx);
  noDuplicates(d.attractions, 'id', 'attractions', ctx);
  noDuplicates(d.decor, 'id', 'decor', ctx);
  noDuplicates(d.routes, 'id', 'routes', ctx);

  const onMap = new Set(d.hostels.map((h) => h.slug));
  d.routes.forEach((r, i) => {
    for (const end of ['from', 'to'] as const) {
      if (!onMap.has(r[end])) {
        ctx.addIssue({ code: 'custom', path: ['routes', i, end], message: `Route "${r.id}" points at ${r[end]}, which is not on this map` });
      }
    }
    if (r.from === r.to) ctx.addIssue({ code: 'custom', path: ['routes', i, 'to'], message: `Route "${r.id}" starts and ends at the same hostel` });
  });

  // The Ibiza firewall (CLAUDE.md): no Nest Pass content on any Ibiza map.
  if (firewalled(d.island)) nestPassStrings(d, [], ctx);
}).meta({
  title: 'Nest island map data',
  description:
    'One island: hostels, things to do, decor, dotted routes and the settings both maps are drawn with. data/seed/<island>.json and the app\'s "Download data (JSON)" share this shape.',
});

/** What the app works with: the file minus the copies of geometry values. */
export type IslandData = Omit<z.output<typeof IslandDataSchema>, 'artboard' | 'projection'>;

const pathData = z.string().regex(/^M[-\d.\sMLZ]+Z$/, 'Path data with M, L and Z only');
const ring = <T extends string>(ringId: T) => z.object({ id: z.literal(ringId), offsetPx: z.number(), d: pathData });

export const GeometrySchema = z
  .object({
    /** The coastline path. The key name predates the app; the committed files are the source of truth. */
    island: pathData,
    name: z.string().min(1),
    artboard: ArtboardSchema,
    source: z.string(),
    projection: ProjectionSchema,
    /** Innermost first: ring-1 … ring-4. */
    rings: z.tuple([ring('ring-1'), ring('ring-2'), ring('ring-3'), ring('ring-4')]),
  })
  .meta({ title: 'Nest island geometry', description: 'data/geometry/<island>.geo.json: coastline, halo rings and projection, in artboard pixels.' });
export type Geometry = z.infer<typeof GeometrySchema>;

export const IconsFileSchema = z.object({
  _note: z.string().optional(),
  icons: z.record(z.string(), z.object({ name: z.string(), paths: z.array(z.string()).min(1) })),
});
export type Icon = { name: string; paths: string[] };
