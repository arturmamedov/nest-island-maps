import type { IslandId } from '../../src/shared/schema.js';
import { ARTBOARD } from '../../src/shared/tokens.js';

/* The inputs of the geometry pipeline (handoff README §5), in one place. The
   numbers are the ones tools/build-island.js ran with; the committed
   data/geometry files were made from them and stay the source of truth, so
   change a value here only to build a new island, never to "improve" one.
   `npm run geometry -- --check` holds the port to the committed files. */

/** An artboard box `[x0, y0, x1, y1]` a coastline is fitted into. */
export type Box = readonly [number, number, number, number];

/**
 * Per island: the name written into its geometry file (the flyers repo's
 * island name, which scripts/sync-hostels.ts maps ids by), the box its
 * coastline is fitted into, and the coast blur σ in grid cells. Ibiza's blur
 * is larger because it is shown larger.
 */
export const ISLAND_CONFIG: Record<IslandId, { name: string; box: Box; blur: number }> = {
  tenerife: { name: 'Tenerife', box: [200, 253, 843, 825], blur: 2.2 },
  gran_canaria: { name: 'Gran Canaria', box: [295, 289, 771, 812], blur: 2.2 },
  ibiza: { name: 'Ibiza', box: [230, 240, 850, 840], blur: 4.2 },
};

/** Artboard pixels of margin on every side of the grid, so the outer rings fit. */
export const PAD = 300;
/** Grid cells per artboard pixel. */
export const K = 1.25;
/** Cells per side of the square grid: artboard −300…1380 at 1.25 cells per pixel (2100). */
export const G = Math.round((ARTBOARD + 2 * PAD) * K);

// Operation order as in the reference (g2a, a2g), so the floats match.
/** A grid coordinate (cell index as coordinate) in artboard pixels. */
export const gridToArtboard = (v: number) => v / K - PAD;
/** An artboard coordinate in grid cells. */
export const artboardToGrid = (v: number) => (v + PAD) * K;

/** Sub-scanlines per cell row in the coast fill (supersampling in y; x coverage is exact). */
export const SUPERSAMPLE = 16;
/** The blur kernel reaches ⌈BLUR_REACH·σ⌉ cells each side. */
export const BLUR_REACH = 3;

/** The coast is the 50 % contour of the blurred coverage (the reference's 127.5 of 255). */
export const COAST_LEVEL = 0.5;
/** A cell is land when its blurred coverage exceeds this (the reference's alpha > 127). */
export const LAND_ABOVE = 127 / 255;

/** Douglas–Peucker tolerances, in artboard pixels. */
export const COAST_SIMPLIFY = 0.35;
export const RING_SIMPLIFY = 0.4;

/**
 * The halo rings, innermost first: each is the coast grown by `offset`
 * artboard px, with concavities narrower than `closing` filled (a
 * morphological closing: dilate by offset + closing, erode by closing).
 */
export const RINGS = [
  { offset: 22, closing: 8 },
  { offset: 62, closing: 26 },
  { offset: 102, closing: 48 },
  { offset: 160, closing: 75 },
] as const;

/** Written into every geometry file, as the committed files have them. */
export const SOURCE = 'OpenStreetMap contributors (ODbL), via Nominatim';
export const PROJECTION_NOTE = 'x = cx + (lngRad - lamC) * s ; y = cy - (ln(tan(pi/4 + latRad/2)) - mC) * s';

/** The Hausdorff check samples each path every this many artboard pixels. */
export const HAUSDORFF_STEP = 0.1;
/** The most any rebuilt path may lie from its committed counterpart, in artboard pixels. */
export const CHECK_TOLERANCE = 1.5;
