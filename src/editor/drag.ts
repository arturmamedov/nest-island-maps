import { clampToArtboard } from '../shared/coords';
import type { Point } from '../shared/geo';
import { clamp, type NudgeRange } from '../shared/labels';
import { ARTBOARD } from '../shared/tokens';

/* The maths behind dragging on the map (spec §2 "Dragging", plan M5), apart
   from the DOM so it can be tested: when a press becomes a drag, how screen
   pixels become artboard pixels, and where a dragged label or icon ends up.
   The edits round again, so the file never depends on this module's care. */

/** A press that moves less than this many screen pixels is a click, never a drag (the prototype had no threshold). */
export const DRAG_THRESHOLD = 3;

/** Whether a press has moved far enough, in screen pixels, to be a drag. */
export const isDrag = (dx: number, dy: number) => Math.hypot(dx, dy) >= DRAG_THRESHOLD;

/** Artboard pixels per screen pixel, for a map drawn `width` pixels wide. */
export const artboardScale = (width: number) => ARTBOARD / width;

/** A client position over the map's <svg>, in artboard pixels. `rect` is the svg's own box, not its frame's. */
export function toArtboard(client: Point, rect: { left: number; top: number; width: number }): Point {
  const s = artboardScale(rect.width);
  return { x: (client.x - rect.left) * s, y: (client.y - rect.top) * s };
}

/* The range comes from the layout (LabelShape.nudge), so the stored nudge is
   the one drawn, never a value the clamp hides. It stretches to take in the
   start: a label the clamp already holds (anchored past the edge) doesn't
   snap to the range on the first move, nor gain a leader it didn't have. A
   pill wider than the box comes as an inverted range (lowest > highest): the
   clamp pins it whatever the nudge, so that axis keeps its start. */
/** The nudge a label drag stores: the start plus the drag (in artboard pixels), whole, inside the range. */
export function nudgeFor(start: { dx: number; dy: number }, delta: Point, range: NudgeRange): { dx: number; dy: number } {
  const axis = (from: number, by: number, [lo, hi]: [number, number]) =>
    // + 0 turns Math.round's −0 into 0.
    lo > hi ? from : clamp(Math.round(from + by) + 0, Math.min(lo, from), Math.max(hi, from));
  return { dx: axis(start.dx, delta.x, range.dx), dy: axis(start.dy, delta.y, range.dy) };
}

/** Where a dragged decor icon's centre goes: its start plus the drag, kept on the artboard. */
export const decorTarget = (start: Point, delta: Point): Point => clampToArtboard({ x: start.x + delta.x, y: start.y + delta.y });
