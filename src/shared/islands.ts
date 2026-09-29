import granCanariaGeo from '../../data/geometry/gran_canaria.geo.json';
import ibizaGeo from '../../data/geometry/ibiza.geo.json';
import tenerifeGeo from '../../data/geometry/tenerife.geo.json';
import granCanariaSeed from '../../data/seed/gran_canaria.json';
import ibizaSeed from '../../data/seed/ibiza.json';
import tenerifeSeed from '../../data/seed/tenerife.json';
import { parseDataFile } from './datafile.js';
import { LAYER_LABELS } from './ids.js';
import { GeometrySchema, ISLAND_IDS, type Geometry, type IslandData, type IslandId, type Layer } from './schema.js';

/* The island registry: geometry and published seed per island. Both are
   validated on load, so a broken committed file fails loudly at startup
   instead of drawing a wrong map. */

export type IslandEntry = { id: IslandId; name: string; geometry: Geometry; seed: IslandData };

function entry(id: IslandId, geo: unknown, seed: unknown): IslandEntry {
  const geometry = GeometrySchema.parse(geo);
  const r = parseDataFile(seed, { id, geometry });
  if (!r.ok) throw new Error(`data/seed/${id}.json: ${r.error}`);
  return { id, name: geometry.name, geometry, seed: r.data };
}

export const ISLANDS: Record<IslandId, IslandEntry> = {
  tenerife: entry('tenerife', tenerifeGeo, tenerifeSeed),
  gran_canaria: entry('gran_canaria', granCanariaGeo, granCanariaSeed),
  ibiza: entry('ibiza', ibizaGeo, ibizaSeed),
};

export const ISLAND_LIST: readonly IslandEntry[] = ISLAND_IDS.map((id) => ISLANDS[id]);

/** What the editor calls one map: "Gran Canaria · Things to do" (the stage caption, a thumbnail's name, the export title). */
export const mapName = (island: IslandId, layer: Layer) => `${ISLANDS[island].name} · ${LAYER_LABELS[layer]}`;
