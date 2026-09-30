import { fitProjection, project, type Point, type ProjectionConstants } from '../../src/shared/geo.js';
import { GeometrySchema, type Geometry, type IslandId } from '../../src/shared/schema.js';
import { ARTBOARD } from '../../src/shared/tokens.js';
import { blur } from './blur.js';
import {
  COAST_LEVEL,
  COAST_SIMPLIFY,
  G,
  ISLAND_CONFIG,
  K,
  LAND_ABOVE,
  PROJECTION_NOTE,
  RING_SIMPLIFY,
  RINGS,
  SOURCE,
  SUPERSAMPLE,
  artboardToGrid,
  gridToArtboard,
  type Box,
} from './config.js';
import { contour } from './contour.js';
import { edt } from './edt.js';
import { toD } from './path.js';
import { rasterise } from './raster.js';
import { dp } from './simplify.js';

/* One island's geometry, from its raw OSM coastline to the committed file
   shape (handoff README §5, tools/build-island.js lines 42–56):
   - the coast: fill the projected ring on the grid, blur it, trace the 50 %
     contour, simplify;
   - the rings: the distance from every cell to the land, grown by
     offset + closing, then shrunk by closing (a morphological closing, which
     gives the blobby look), traced and simplified.
   Pure and deterministic; scripts/build-geometry.ts does the file work. */

/** A coastline as the raw file holds it: one closed ring of [lng, lat] pairs. */
export type Coast = readonly (readonly [number, number])[];

/** The land cells of a blurred coverage field (the reference's `alpha > 127`). */
export function landMask(field: Float64Array): Uint8Array {
  const land = new Uint8Array(field.length);
  for (let i = 0; i < field.length; i++) land[i] = field[i] > LAND_ABOVE ? 1 : 0;
  return land;
}

/** The cells farther than `reach` from the land (the reference's `D`); a cell at exactly `reach` stays inside. */
export function beyond(dist: Float64Array, reach: number): Uint8Array {
  const out = new Uint8Array(dist.length);
  for (let i = 0; i < dist.length; i++) out[i] = dist[i] <= reach ? 0 : 1;
  return out;
}

const toArtboard = (line: readonly Point[]): Point[] => line.map((p) => ({ x: gridToArtboard(p.x), y: gridToArtboard(p.y) }));

/** The fitted projection, the simplified coast and the four simplified rings (innermost first), in artboard pixels. */
export function traceIsland(coast: Coast, box: Box, sigma: number): { projection: ProjectionConstants; island: Point[]; rings: Point[][] } {
  const projection = fitProjection(coast, box);
  const polygon = coast.map(([lng, lat]) => {
    const p = project(projection, lat, lng);
    return { x: artboardToGrid(p.x), y: artboardToGrid(p.y) };
  });
  const field = blur(rasterise(polygon, G, SUPERSAMPLE), G, sigma);
  const island = dp(toArtboard(contour(field, G, COAST_LEVEL)), COAST_SIMPLIFY);
  const toLand = edt(landMask(field), G);
  const rings = RINGS.map(({ offset, closing }) => {
    const toOutside = edt(beyond(toLand, (offset + closing) * K), G);
    return dp(toArtboard(contour(toOutside, G, closing * K)), RING_SIMPLIFY);
  });
  return { projection, island, rings };
}

/**
 * The geometry file in the committed shape and key order (validated by
 * GeometrySchema): the coast, the island's name, the artboard, the source,
 * the projection with its note, and the four rings with their offsets.
 */
export function geometryFile(id: IslandId, projection: ProjectionConstants, island: string, rings: readonly string[]): Geometry {
  return GeometrySchema.parse({
    island,
    name: ISLAND_CONFIG[id].name,
    artboard: [ARTBOARD, ARTBOARD],
    source: SOURCE,
    projection: { type: 'mercator', ...projection, note: PROJECTION_NOTE },
    rings: RINGS.map((r, k) => ({ id: `ring-${k + 1}`, offsetPx: r.offset, d: rings[k] })),
  });
}

/** A geometry file's bytes, as committed: one line, no trailing newline. */
export const serializeGeometry = (geometry: Geometry): string => JSON.stringify(geometry);

/** Builds one island's geometry file from its raw coastline, with the island's configured box and blur. */
export function buildIsland(id: IslandId, coast: Coast): Geometry {
  const { box, blur: sigma } = ISLAND_CONFIG[id];
  const traced = traceIsland(coast, box, sigma);
  return geometryFile(id, traced.projection, toD(traced.island), traced.rings.map((ring) => toD(ring)));
}
