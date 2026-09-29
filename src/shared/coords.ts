import { project, unproject, type Point, type ProjectionConstants } from './geo.js';
import { ARTBOARD } from './tokens.js';

/* The "Lat, lng" row input takes what Google Maps copies when you right-click
   the pin ("28.04700, -16.53550"), plus ";" or a space as separator. A Maps
   URL is refused: its @ numbers are the viewport centre, not the pin. */

export type CoordsResult = { ok: true; lat: number; lng: number } | { ok: false; error: string };

/** Why an off-artboard point is refused; the edits reuse it. */
export const OFF_MAP = 'That point is off the map: are lat and lng swapped?';
const PAIR = /^(-?\d+(?:\.\d+)?)\s*(?:[,;]\s*|\s+)(-?\d+(?:\.\d+)?)$/;
const LINK = /@|https?:|maps\.|goo\.gl/i;

const fail = (error: string): CoordsResult => ({ ok: false, error });

/** Whether a point projects onto the 1080 artboard. The edits refuse off-map numbers with this same rule. */
export function onArtboard(projection: ProjectionConstants, lat: number, lng: number): boolean {
  const { x, y } = project(projection, lat, lng);
  return x >= 0 && x <= ARTBOARD && y >= 0 && y <= ARTBOARD;
}

/** With a projection, also refuses points off the artboard (usually lat and lng swapped). */
export function parseCoords(text: string, projection?: ProjectionConstants): CoordsResult {
  const t = text.trim();
  if (!t) return fail('Paste "lat, lng" from Google Maps');
  if (LINK.test(t)) return fail('That is a Maps link: right-click the pin and copy its coordinates (the link shows the viewport)');
  const m = PAIR.exec(t);
  if (!m) return fail('Use "lat, lng", for example 28.04700, -16.53550');
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90) return fail('Latitude runs from -90 to 90');
  if (Math.abs(lng) > 180) return fail('Longitude runs from -180 to 180');
  if (projection && !onArtboard(projection, lat, lng)) return fail(OFF_MAP);
  return { ok: true, lat, lng };
}

export const formatCoords = (lat: number, lng: number) => `${lat}, ${lng}`;

/** Decimal places kept for a point made on the map: about a metre, where a pixel is well over 100 m. */
export const LATLNG_PLACES = 5;

/* Half a pixel in from each edge: rounding to 5 decimals moves a point by
   under 0.01 px, so a point clamped here can never be rounded off the
   artboard, and the edits' own off-map rule never refuses a click or a drag. */
const EDGE = 0.5;

/** Keeps an artboard position on the artboard, half a pixel inside its edges. */
export function clampToArtboard(p: Point): Point {
  const clamp = (v: number) => Math.min(ARTBOARD - EDGE, Math.max(EDGE, v));
  return { x: clamp(p.x), y: clamp(p.y) };
}

/** The lat/lng under an artboard position (a click, a drop, the centre), kept on the artboard, to 5 decimals. */
export function latLngAt(projection: ProjectionConstants, p: Point): { lat: number; lng: number } {
  const c = clampToArtboard(p);
  const { lat, lng } = unproject(projection, c.x, c.y);
  const round = (n: number) => Math.round(n * 10 ** LATLNG_PLACES) / 10 ** LATLNG_PLACES;
  return { lat: round(lat), lng: round(lng) };
}
