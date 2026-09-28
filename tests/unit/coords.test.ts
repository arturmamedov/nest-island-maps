import { describe, expect, it } from 'vitest';
import { formatCoords, onArtboard, parseCoords } from '../../src/shared/coords.js';
import { ISLANDS } from '../../src/shared/islands.js';

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
