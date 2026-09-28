import { ARTBOARD } from './tokens.js';
import { IslandDataSchema, type Geometry, type IslandData, type IslandId } from './schema.js';

/* The island file on disk and the app's "Download data (JSON)" are the same
   bytes, so publishing is: download, drop into data/seed/, commit. The file
   carries the artboard and the geometry's projection for the WordPress theme;
   the app always takes the projection from the geometry file itself. */

type IslandRef = { id: IslandId; geometry: Geometry };

export type ParseResult = { ok: true; data: IslandData } | { ok: false; error: string };

/** Key order of the file: the spec's export shape. */
export function toDataFile(data: IslandData, geometry: Geometry) {
  return {
    island: data.island,
    name: data.name,
    artboard: [ARTBOARD, ARTBOARD],
    projection: geometry.projection,
    hostels: data.hostels,
    attractions: data.attractions,
    decor: data.decor,
    routes: data.routes,
    settings: data.settings,
  };
}

export function serializeDataFile(data: IslandData, geometry: Geometry): string {
  return JSON.stringify(toDataFile(data, geometry), null, 2) + '\n';
}

const PROJECTION_KEYS = ['s', 'lamC', 'mC', 'cx', 'cy'] as const;

/** One schema issue as staff read it: "hostels.2.lat: …". */
export const issueText = (i: { path: readonly PropertyKey[]; message: string }) => (i.path.length ? `${i.path.map(String).join('.')}: ${i.message}` : i.message);

/** Validates a seed, a draft or an imported file for one island. */
export function parseDataFile(json: unknown, island: IslandRef): ParseResult {
  if (json && typeof json === 'object' && 'island' in json && json.island !== island.id) {
    const other = 'name' in json && typeof json.name === 'string' ? json.name : String(json.island);
    return { ok: false, error: `This file is for ${other}, not ${island.geometry.name}` };
  }
  const r = IslandDataSchema.safeParse(json);
  if (!r.success) {
    const lines = r.error.issues.slice(0, 3).map(issueText);
    const more = r.error.issues.length > 3 ? ` (+${r.error.issues.length - 3} more)` : '';
    return { ok: false, error: lines.join('; ') + more };
  }
  const { artboard: _, projection, ...data } = r.data;
  // A different projection means pins would land elsewhere: a stale file or the wrong geometry.
  if (projection && PROJECTION_KEYS.some((k) => projection[k] !== island.geometry.projection[k])) {
    return { ok: false, error: `The projection in this file does not match ${island.geometry.name}'s geometry` };
  }
  return { ok: true, data };
}
