import type { Point } from '../shared/geo';
import type { IslandData } from '../shared/schema';
import { addAttraction, addDecor, addHostel, placeAt, type IslandEdit, type PointKind } from './state';

/* Placing (spec §2 "Adding points"): "⌖ Click map to place" arms the large
   map, and the next click there makes or moves a point. What each placement
   does, and what the banner and the status line say, is written here once:
   "+ Add row", "+ Add icon" and "+ Add hostel" report the same words when
   they add at the centre. The click itself becomes lat/lng in the edit, so
   the data never holds a hand-placed pixel (README ground rules). */

/** What the next click on the large map does. */
export type Placement =
  /** Things to do: a new spot. */
  | { kind: 'spot' }
  /** Decor: a new icon. */
  | { kind: 'icon' }
  /** Hostels: one of the island's real hostels that is not on the map (decision 3), unverified. */
  | { kind: 'hostel'; slug: string; name: string }
  /** A row's own point moved to the click ("⌖ Place on map"); a hostel moved this way is unverified. */
  | { kind: 'move'; collection: PointKind; key: string; label: string };

/** The prototype's button: what arms placing, and what it reads while armed. */
export const PLACE = '⌖ Click map to place';
export const CANCEL_PLACING = 'Cancel placing';

/** The prototype's status after "+ Add row" or placing a spot, word for word. */
export const ADDED_SPOT = 'Added — rename it in the list';
/** The prototype's status after "+ Add icon" or placing an icon, word for word. */
export const ADDED_ICON = 'Icon added — click it in the list to change the icon';
/** The status after a hostel comes back, from "+ Add hostel" or placed on the map. */
export const hostelAdded = (name: string) => `${name} added`;

/** What a placement shows and does. */
export type PlacementPlan = {
  /** The dark pill over the map while armed. */
  banner: string;
  /** The edit for a click at an artboard position. */
  edit: (at: Point) => IslandEdit;
  /** The status line once placed. */
  done: string;
};

const ESC = ' · Esc to cancel';

/** The banner, the edit for a click at an artboard position, and the status once placed. */
export function placementPlan(p: Placement): PlacementPlan {
  switch (p.kind) {
    case 'spot':
      return { banner: `Click the island to drop a new spot${ESC}`, edit: (at) => addAttraction(at), done: ADDED_SPOT };
    case 'icon':
      return { banner: `Click the map to drop a decor icon${ESC}`, edit: (at) => addDecor(at), done: ADDED_ICON };
    case 'hostel':
      return { banner: `Click the island to drop ${p.name}${ESC}`, edit: (at) => addHostel(p.slug, at), done: hostelAdded(p.name) };
    case 'move':
      return { banner: `Click the island to move ${p.label}${ESC}`, edit: (at) => placeAt(p.collection, p.key, at), done: `${p.label} moved` };
  }
}

/* A placement can outlive its target: the row it would move is removed with
   its ×, or the hostel it would drop comes back through "+ Add hostel". Then
   it no longer applies, and usePlacing cancels it, rather than leaving the
   banner up for a click the edit would refuse. */
/** Whether a placement still has something to do in this island's data. */
export function placementApplies(p: Placement, data: IslandData): boolean {
  switch (p.kind) {
    case 'spot':
    case 'icon':
      return true;
    case 'hostel':
      return !data.hostels.some((h) => h.slug === p.slug);
    case 'move':
      return p.collection === 'hostels' ? data.hostels.some((h) => h.slug === p.key) : data.attractions.some((a) => a.id === p.key);
  }
}
