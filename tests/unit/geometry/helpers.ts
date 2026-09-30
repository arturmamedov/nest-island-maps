import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Point } from '../../../src/shared/geo.js';
import type { IslandId } from '../../../src/shared/schema.js';

/* Test helpers shared by the geometry pipeline's tests. */

export const ROOT = join(import.meta.dirname, '..', '..', '..');

/** The raw OSM coastlines, one closed [lng, lat] ring per island (the pipeline's input). */
export const rawCoastlines = () =>
  JSON.parse(readFileSync(join(ROOT, 'design_handoff_island_maps/tools/raw-osm-coastlines.json'), 'utf8')) as Record<IslandId, [number, number][]>;

/** A committed geometry file's exact text. */
export const committedText = (id: IslandId) => readFileSync(join(ROOT, 'data/geometry', `${id}.geo.json`), 'utf8');

/** Twice the signed area of a closed polygon; with y pointing down, positive means clockwise on screen. */
export function shoelace(pts: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}
