import { describe, expect, it } from 'vitest';
import { clampToArtboard, formatCoords, latLngAt, onArtboard, parseCoords } from '../../src/shared/coords.js';
import { project } from '../../src/shared/geo.js';
import { ISLAND_LIST, ISLANDS } from '../../src/shared/islands.js';

const tenerife = ISLANDS.tenerife.geometry.projection;

describe('parseCoords', () => {
  it.each([
    ['28.04700, -16.53550', 28.047, -16.5355],
    ['28.047;-16.5355', 28.047, -16.5355],
    ['28.047 -16.5355', 28.047, -16.5355],
    ['  28.047 ,  -16.5355  ', 28.047, -16.5355],
    ['28.047; -16.5355', 28.047, -16.5355],
    ['-33.9, 151.2', -33.9, 151.2],
    ['28, -16', 28, -16],
  ])('accepts %j', (text, lat, lng) => {
    expect(parseCoords(text)).toEqual({ ok: true, lat, lng });
  });

  it.each([
    [''],
    ['abc'],
    ['28.047'],
    ['28.047, -16.5355, 12'],
    ['28,047, -16,5355'],
    ['95, 10'],
    ['10, 190'],
  ])('rejects %j', (text) => {
    expect(parseCoords(text).ok).toBe(false);
  });

  it('rejects a Maps link: its @ numbers are the viewport, not the pin', () => {
    for (const text of [
      'https://www.google.com/maps/@28.0470,-16.5355,15z',
      '@28.0470,-16.5355',
      'maps.app.goo.gl/abc',
    ]) {
      const r = parseCoords(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/link/i);
    }
  });

  it('rejects a point off the artboard, which catches swapped lat and lng', () => {
    expect(parseCoords('28.047, -16.5355', tenerife).ok).toBe(true);
    const swapped = parseCoords('-16.5355, 28.047', tenerife);
    expect(swapped.ok).toBe(false);
    if (!swapped.ok) expect(swapped.error).toMatch(/off the map/i);
  });
});

describe('onArtboard', () => {
  it('is the parser rule on numbers: the edits refuse off-map points with it', () => {
    expect(onArtboard(tenerife, 28.047, -16.5355)).toBe(true);
    expect(onArtboard(tenerife, -16.5355, 28.047)).toBe(false);
    expect(onArtboard(tenerife, 28.047, Number.NaN)).toBe(false);
  });
});

describe('formatCoords', () => {
  it('round-trips through the parser', () => {
    const text = formatCoords(28.0455, -16.5385);
    expect(text).toBe('28.0455, -16.5385');
    expect(parseCoords(text)).toEqual({ ok: true, lat: 28.0455, lng: -16.5385 });
  });
});

describe('clampToArtboard', () => {
  it('keeps a point half a pixel inside the artboard', () => {
    expect(clampToArtboard({ x: 540, y: 12.3 })).toEqual({ x: 540, y: 12.3 });
    expect(clampToArtboard({ x: -40, y: 2000 })).toEqual({ x: 0.5, y: 1079.5 });
    expect(clampToArtboard({ x: 1080, y: 0 })).toEqual({ x: 1079.5, y: 0.5 });
  });
});

describe('latLngAt', () => {
  const fiveDecimals = (n: number) => expect(Math.round(n * 1e5) / 1e5).toBe(n);

  it('is the point under an artboard position, to 5 decimals, which projects back within 0.01 px', () => {
    for (const { geometry } of ISLAND_LIST) {
      for (const p of [{ x: 540, y: 540 }, { x: 100.3, y: 900.7 }, { x: 1.2, y: 1078.9 }]) {
        const at = latLngAt(geometry.projection, p);
        fiveDecimals(at.lat);
        fiveDecimals(at.lng);
        const back = project(geometry.projection, at.lat, at.lng);
        expect(Math.abs(back.x - p.x)).toBeLessThan(0.01);
        expect(Math.abs(back.y - p.y)).toBeLessThan(0.01);
      }
    }
  });

  it('keeps every point on the artboard, so the edits never refuse a click or a drag at the edge', () => {
    for (const { geometry } of ISLAND_LIST) {
      for (const p of [{ x: -50, y: 540 }, { x: 2000, y: -3 }, { x: 0, y: 0 }, { x: 1080, y: 1080 }]) {
        const at = latLngAt(geometry.projection, p);
        expect(onArtboard(geometry.projection, at.lat, at.lng)).toBe(true);
      }
      const edge = latLngAt(geometry.projection, { x: -50, y: 540 });
      expect(project(geometry.projection, edge.lat, edge.lng).x).toBeCloseTo(0.5, 1);
    }
  });
});
