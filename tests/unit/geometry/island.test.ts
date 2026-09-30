import { beforeAll, describe, expect, it } from 'vitest';
import { fitProjection, parsePolygons } from '../../../src/shared/geo.js';
import { GeometrySchema, ISLAND_IDS, type Geometry } from '../../../src/shared/schema.js';
import { compareGeometry } from '../../../scripts/geometry/compare.js';
import { CHECK_TOLERANCE, G, ISLAND_CONFIG, artboardToGrid, gridToArtboard } from '../../../scripts/geometry/config.js';
import { beyond, buildIsland, geometryFile, landMask, serializeGeometry } from '../../../scripts/geometry/island.js';
import { committedText, rawCoastlines, shoelace } from './helpers.js';

/* The pipeline's own pieces: the grid, the two masks whose tie operators the
   rings depend on, and the file shape, which must reproduce the committed
   geometry files byte for byte. */

const raw = rawCoastlines();

describe('the grid', () => {
  it('spans the artboard −300…1380 at 1.25 cells per pixel', () => {
    expect(G).toBe(2100);
    expect(artboardToGrid(-300)).toBe(0);
    expect(gridToArtboard(G)).toBe(1380);
    for (const v of [0, 123.4, 1079.9]) expect(gridToArtboard(artboardToGrid(v))).toBeCloseTo(v, 9);
  });
});

describe('masks', () => {
  it('beyond keeps a cell at exactly the reach inside the grown shape (ring 2 reaches exactly 110)', () => {
    expect(Array.from(beyond(Float64Array.of(109, 110, 110.0000001), 110))).toEqual([0, 0, 1]);
  });

  it('landMask counts a cell as land only above 127/255 (the reference read alpha > 127)', () => {
    expect(Array.from(landMask(Float64Array.of(127 / 255, 0.5)))).toEqual([0, 1]);
  });
});

describe('geometryFile', () => {
  for (const id of ISLAND_IDS) {
    it(`${id}: rebuilds the committed bytes from the committed paths`, () => {
      const text = committedText(id);
      const committed = GeometrySchema.parse(JSON.parse(text));
      const projection = fitProjection(raw[id], ISLAND_CONFIG[id].box);
      const file = geometryFile(
        id,
        projection,
        committed.island,
        committed.rings.map((r) => r.d),
      );
      expect(serializeGeometry(file)).toBe(text);
    });
  }
});

/* The whole pipeline on one island, so `npm test` guards the port too
   (about 2 s; `npm run geometry -- --check` covers all three). */
describe('tenerife, built from the raw coastline', () => {
  let built: Geometry;
  const outline = (d: string) => parsePolygons(d)[0]!;
  beforeAll(() => {
    built = buildIsland('tenerife', raw.tenerife);
  }, 30_000);

  it('passes GeometrySchema and the committed path format', () => {
    expect(GeometrySchema.safeParse(built).success).toBe(true);
    for (const d of [built.island, ...built.rings.map((r) => r.d)]) expect(d).toMatch(/^M\d+\.\d \d+\.\d(L\d+\.\d \d+\.\d)+Z$/);
  });

  it(`lies within ${CHECK_TOLERANCE} px of the committed paths, with the rest of the file identical`, () => {
    const { sameOtherwise, paths } = compareGeometry(built, GeometrySchema.parse(JSON.parse(committedText('tenerife'))));
    expect(sameOtherwise).toBe(true);
    for (const { path, distance } of paths) expect(distance, path).toBeLessThanOrEqual(CHECK_TOLERANCE);
  });

  it('runs the coast, ring-2 and ring-4 clockwise on screen', () => {
    // Their levels can't tie; rings 1 and 3 trace at exact ties, where the reference walk may turn (see contour.test.ts).
    for (const d of [built.island, built.rings[1].d, built.rings[3].d]) expect(shoelace(outline(d))).toBeGreaterThan(0);
  });

  it('starts every path at its top', () => {
    for (const d of [built.island, ...built.rings.map((r) => r.d)]) {
      const pts = outline(d);
      expect(pts[0]!.y - Math.min(...pts.map((p) => p.y))).toBeLessThan(1);
    }
  });
});
