import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitProjection, isOnLand, parsePolygons, pathPolygons, pointInPolygons, project, unproject } from '../../src/shared/geo.js';
import { ISLAND_IDS, type IslandId } from '../../src/shared/schema.js';
import { ISLANDS } from '../../src/shared/islands.js';
import { ISLAND_CONFIG } from '../../scripts/geometry/config.js';

const ROOT = join(import.meta.dirname, '..', '..');
const raw = JSON.parse(
  readFileSync(join(ROOT, 'design_handoff_island_maps/tools/raw-osm-coastlines.json'), 'utf8'),
) as Record<IslandId, [number, number][]>;

describe('projection', () => {
  for (const id of ISLAND_IDS) {
    const p = ISLANDS[id].geometry.projection;

    // The geometry pipeline's own boxes (scripts/geometry/config.ts), so the fit it runs is the one checked here.
    it(`${id}: the fit reproduces the committed constants exactly`, () => {
      const fitted = fitProjection(raw[id], ISLAND_CONFIG[id].box);
      expect(fitted).toEqual({ s: p.s, lamC: p.lamC, mC: p.mC, cx: p.cx, cy: p.cy });
    });

    it(`${id}: unproject inverts project`, () => {
      for (const h of ISLANDS[id].seed.hostels) {
        const { x, y } = project(p, h.lat, h.lng);
        const back = unproject(p, x, y);
        expect(Math.abs(back.lat - h.lat)).toBeLessThan(1e-9);
        expect(Math.abs(back.lng - h.lng)).toBeLessThan(1e-9);
      }
    });

    it(`${id}: the coastline lands inside its box`, () => {
      const [x0, y0, x1, y1] = ISLAND_CONFIG[id].box;
      for (const [lng, lat] of raw[id]) {
        const { x, y } = project(p, lat, lng);
        expect(x).toBeGreaterThanOrEqual(x0 - 1e-6);
        expect(x).toBeLessThanOrEqual(x1 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(y0 - 1e-6);
        expect(y).toBeLessThanOrEqual(y1 + 1e-6);
      }
    });
  }
});

describe('polygons', () => {
  it('parses M/L/Z paths into closed rings', () => {
    expect(parsePolygons('M0 0L10 0L10 10L0 10Z')).toEqual([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    ]);
    expect(parsePolygons('M1.5 -2L3 4ZM5 5L6 6L5 6Z')).toHaveLength(2);
  });

  it('refuses curves: the geometry files only hold straight segments', () => {
    expect(() => parsePolygons('M0 0Q5 5 10 0Z')).toThrow();
  });

  it('tests points inside and outside', () => {
    const square = parsePolygons('M0 0L10 0L10 10L0 10Z');
    expect(pointInPolygons(square, 5, 5)).toBe(true);
    expect(pointInPolygons(square, 15, 5)).toBe(false);
    expect(pointInPolygons(square, -1, -1)).toBe(false);
  });

  it('parses each path once', () => {
    const d = ISLANDS.tenerife.geometry.island;
    expect(pathPolygons(d)).toBe(pathPolygons(d));
  });

  it('knows which Tenerife hostels sit on the island (the "in the sea" badge)', () => {
    const { geometry, seed } = ISLANDS.tenerife;
    const on = (slug: string) => {
      const h = seed.hostels.find((x) => x.slug === slug)!;
      return isOnLand(geometry, h.lat, h.lng);
    };
    expect(on('adeje-nest')).toBe(true);
    // Approximate coordinates that project just offshore until the owner verifies them.
    expect(on('puerto-nest')).toBe(false);
    expect(on('las-eras-nest')).toBe(false);
  });
});
