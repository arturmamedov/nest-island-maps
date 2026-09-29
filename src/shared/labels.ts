import type { Point } from './geo.js';
import type { LabelStyle, Layer, Settings, Side } from './schema.js';
import { BADGE, DOT, LABEL_BOX, LABEL_FONTS, LABEL_GAP, LEADER, PILL, PIN, WHITE, type Palette } from './tokens.js';

/* Label maths (handoff README §1 "Labels"): pill metrics, the anchor offset
   of each side from each kind of marker, the clamp box and the leader rule.
   Numbers stay unrounded here; layout.ts rounds them once, where they are
   written into the SVG. Text width is the only thing that needs a real
   font, so it comes in through a TextMeasurer and this module stays DOM-free. */

export type FontSpec = { family: string; weight: number; size: number };
/** Width in px of `text` set in `font`, without letter spacing. */
export type TextMeasurer = (text: string, font: FontSpec) => number;

/** Hostel pin, hostel dot, attraction badge. */
export type MarkerKind = 'pin' | 'dot' | 'badge';

export type PillMetrics = { font: FontSpec; fs: number; ls: number; h: number; padX: number; r: number };

export function pillMetrics(settings: Pick<Settings, 'labelFont' | 'labelSize' | 'labelTracking'>): PillMetrics {
  const { family, weight, condensed } = LABEL_FONTS[settings.labelFont];
  const pill = condensed ? PILL.condensed : PILL.wide;
  const fs = settings.labelSize;
  const h = fs * pill.height;
  return { font: { family, weight, size: fs }, fs, ls: fs * settings.labelTracking, h, padX: fs * pill.padX, r: h * pill.radius };
}

/** Pill width for already-uppercased text: tracking follows every character, including the last. */
export function labelWidth(text: string, m: PillMetrics, measure: TextMeasurer): number {
  return measure(text, m.font) + m.ls * [...text].length + 2 * m.padX;
}

/* The dot is drawn scaled by pinSize like the pin, so its label keeps the
   same gap at every size (docs/decisions.md). The badge never scales. */
const markerRadius = (kind: 'dot' | 'badge', pinSize: number) => (kind === 'badge' ? BADGE.r : DOT.outerR * pinSize);

/** Offset of the label centre from the marker point (the pin tip, or the dot/badge centre). */
export function anchorOffset(kind: MarkerKind, side: Side, pinSize: number, w: number, h: number): Point {
  const gap = LABEL_GAP;
  if (kind === 'pin') {
    const ps = pinSize;
    switch (side) {
      case 'below':
        return { x: 0, y: gap + h / 2 };
      case 'above':
        return { x: 0, y: -(PIN.top * ps + gap + h / 2) };
      case 'right':
        return { x: PIN.headR * ps + gap + w / 2, y: PIN.headY * ps };
      case 'left':
        return { x: -(PIN.headR * ps + gap + w / 2), y: PIN.headY * ps };
    }
  }
  const r = markerRadius(kind, pinSize);
  switch (side) {
    case 'below':
      return { x: 0, y: r + gap + h / 2 };
    case 'above':
      return { x: 0, y: -(r + gap + h / 2) };
    case 'right':
      return { x: r + gap + w / 2, y: 0 };
    case 'left':
      return { x: -(r + gap + w / 2), y: 0 };
  }
}

/** Where a leader line starts: the pin's head centre, or the centre of a dot or badge. */
export function headOffset(kind: MarkerKind, pinSize: number): Point {
  return { x: 0, y: kind === 'pin' ? PIN.headY * pinSize : 0 };
}

/** Where the centre of a w × h pill may go so the pill stays inside LABEL_BOX. The clamp and the editor's label drag share it. */
export function labelCentreBox(w: number, h: number) {
  return { x0: LABEL_BOX.x0 + w / 2, x1: LABEL_BOX.x1 - w / 2, y0: LABEL_BOX.y0 + h / 2, y1: LABEL_BOX.y1 - h / 2 };
}

/** Min before max, so a pill wider than the box is pinned to its right (or bottom) edge; the drag clamps the same way. */
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Clamps a label centre so a w × h pill stays inside LABEL_BOX. */
export function clampLabel(p: Point, w: number, h: number): Point {
  const b = labelCentreBox(w, h);
  return { x: clamp(p.x, b.x0, b.x1), y: clamp(p.y, b.y0, b.y1) };
}

/** A whole-pixel range per axis, [lowest, highest]. */
export type NudgeRange = { dx: [number, number]; dy: [number, number] };

/* The nudges a drag may store: whole pixels that keep the pill inside the
   box, measured from where the label sits before any nudge. Rounded inwards,
   so both ends are drawn exactly where the nudge says. */
/** The whole-pixel dx and dy that keep a w × h pill, centred on `base` plus the nudge, inside LABEL_BOX. */
export function nudgeRange(base: Point, w: number, h: number): NudgeRange {
  const b = labelCentreBox(w, h);
  return { dx: [Math.ceil(b.x0 - base.x), Math.floor(b.x1 - base.x)], dy: [Math.ceil(b.y0 - base.y), Math.floor(b.y1 - base.y)] };
}

/** A label nudged further than LEADER.minOffset gets a leader line back to its marker. */
export function hasLeader(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > LEADER.minOffset;
}

export type Leader = { x1: number; y1: number; x2: number; y2: number };

/** The label centre, and `base`: where it sits before the nudge and the clamp. */
export type PlacedLabel = Point & { base: Point; leader: Leader | null };

/** Anchor, then the free dx/dy nudge, then the clamp. The leader rule looks at the raw nudge. */
export function placeLabel(o: { kind: MarkerKind; side: Side; dx: number; dy: number; at: Point; pinSize: number; w: number; h: number }): PlacedLabel {
  const a = anchorOffset(o.kind, o.side, o.pinSize, o.w, o.h);
  const base = { x: o.at.x + a.x, y: o.at.y + a.y };
  const c = clampLabel({ x: base.x + o.dx, y: base.y + o.dy }, o.w, o.h);
  const head = headOffset(o.kind, o.pinSize);
  const leader = hasLeader(o.dx, o.dy) ? { x1: o.at.x + head.x, y1: o.at.y + head.y, x2: c.x, y2: c.y } : null;
  return { ...c, base, leader };
}

/** `fill: null` is the text-only style: no pill and no shadow, the text carries a white halo instead. */
export type LabelLook = { fill: string | null; color: string; halo: boolean };

export function labelLook(style: LabelStyle, layer: Layer, palette: Palette): LabelLook {
  switch (style) {
    case 'accent':
      // The accent pill marks hostels; things to do stay white so the two maps read differently.
      return { fill: layer === 'hostels' ? palette.accent : WHITE, color: palette.ink, halo: false };
    case 'white':
      return { fill: WHITE, color: palette.ink, halo: false };
    case 'dark':
      return { fill: palette.ink, color: WHITE, halo: false };
    case 'text':
      return { fill: null, color: palette.ink, halo: true };
  }
}
