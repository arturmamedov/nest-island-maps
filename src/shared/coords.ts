import { project, type ProjectionConstants } from './geo.js';
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
