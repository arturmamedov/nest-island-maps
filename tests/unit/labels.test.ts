import { describe, expect, it } from 'vitest';
import {
  anchorOffset,
  clampLabel,
  hasLeader,
  headOffset,
  labelCentreBox,
  labelLook,
  labelWidth,
  nudgeRange,
  pillMetrics,
  placeLabel,
  type MarkerKind,
  type TextMeasurer,
} from '../../src/shared/labels.js';
import { DEFAULT_SETTINGS, SIDES, type Side } from '../../src/shared/schema.js';
import { PALETTES, WHITE } from '../../src/shared/tokens.js';

/* Label maths from the handoff README §1 "Labels", unrounded: rounding only
   happens where numbers are written into the SVG (layout.ts). */

const stub: TextMeasurer = (text, { size }) => [...text].length * size * 0.55;
const close = (actual: { x: number; y: number }, expected: [number, number]) => {
  expect(actual.x).toBeCloseTo(expected[0], 9);
  expect(actual.y).toBeCloseTo(expected[1], 9);
};

describe('pill metrics', () => {
  it('match the Photoshop label at the defaults (Roboto Condensed 700, 25 px, 0.19 em)', () => {
    const m = pillMetrics(DEFAULT_SETTINGS);
    expect(m.font).toEqual({ family: 'Roboto Condensed', weight: 700, size: 25 });
    expect(m.fs).toBe(25);
    expect(m.ls).toBeCloseTo(4.75, 12);
    expect(m.h).toBeCloseTo(35.5, 12);
    expect(m.padX).toBeCloseTo(13.75, 12);
    expect(m.r).toBeCloseTo(17.75, 12);
  });

  it('use the taller, squarer pill for the wide faces', () => {
    const m = pillMetrics({ ...DEFAULT_SETTINGS, labelFont: 'montserrat' });
    expect(m.font).toEqual({ family: 'Montserrat', weight: 700, size: 25 });
    expect(m.h).toBeCloseTo(42.5, 12);
    expect(m.padX).toBeCloseTo(18.75, 12);
    expect(m.r).toBeCloseTo(12.75, 12);
  });

  it('scale with the label size and tracking', () => {
    const m = pillMetrics({ ...DEFAULT_SETTINGS, labelSize: 20, labelTracking: 0.1 });
    expect(m.ls).toBeCloseTo(2, 12);
    expect(m.h).toBeCloseTo(28.4, 12);
  });

  it('width = measured text + tracking per character + both paddings', () => {
    const m = pillMetrics(DEFAULT_SETTINGS);
    // "MÉDANO": 6 characters, one precomposed accent.
    expect(labelWidth('MÉDANO', m, stub)).toBeCloseTo(6 * 25 * 0.55 + 4.75 * 6 + 2 * 13.75, 9);
  });

  it('counts characters by code point', () => {
    const m = pillMetrics(DEFAULT_SETTINGS);
    const measured: string[] = [];
    labelWidth('ÉS VEDRÀ', m, (t, f) => (measured.push(t), stub(t, f)));
    expect(measured).toEqual(['ÉS VEDRÀ']);
    expect(labelWidth('ÉS VEDRÀ', m, () => 0)).toBeCloseTo(4.75 * 8 + 27.5, 9);
  });
});

describe('anchor offsets (gap 8, pinSize 0.9, w 100, h 35.5)', () => {
  const ps = 0.9;
  const w = 100;
  const h = 35.5;
  const table: Record<MarkerKind, Record<Side, [number, number]>> = {
    pin: {
      below: [0, 8 + 17.75],
      above: [0, -(46 * ps + 8 + 17.75)],
      right: [16 * ps + 8 + 50, -30 * ps],
      left: [-(16 * ps + 8 + 50), -30 * ps],
    },
    badge: {
      below: [0, 22 + 8 + 17.75],
      above: [0, -(22 + 8 + 17.75)],
      right: [22 + 8 + 50, 0],
      left: [-(22 + 8 + 50), 0],
    },
    // The dot is drawn scaled by pinSize, so its radius is 11·ps (docs/decisions.md).
    dot: {
      below: [0, 11 * ps + 8 + 17.75],
      above: [0, -(11 * ps + 8 + 17.75)],
      right: [11 * ps + 8 + 50, 0],
      left: [-(11 * ps + 8 + 50), 0],
    },
  };
  for (const kind of ['pin', 'dot', 'badge'] as const) {
    for (const side of SIDES) {
      it(`${kind} ${side}`, () => close(anchorOffset(kind, side, ps, w, h), table[kind][side]));
    }
  }

  it('the badge ignores pinSize', () => {
    close(anchorOffset('badge', 'right', 1.4, w, h), table.badge.right);
  });

  it('leaders start at the pin head, or at the centre of a dot or badge', () => {
    close(headOffset('pin', ps), [0, -27]);
    close(headOffset('dot', ps), [0, 0]);
    close(headOffset('badge', ps), [0, 0]);
  });
});

describe('clamping', () => {
  const w = 100;
  const h = 35.5;
  it('keeps the pill inside x 12…1068 and y 12…1040', () => {
    close(clampLabel({ x: 0, y: 500 }, w, h), [62, 500]);
    close(clampLabel({ x: 1080, y: 500 }, w, h), [1018, 500]);
    close(clampLabel({ x: 500, y: 0 }, w, h), [500, 12 + 17.75]);
    close(clampLabel({ x: 500, y: 1080 }, w, h), [500, 1040 - 17.75]);
  });

  it('leaves a label inside the box alone', () => {
    close(clampLabel({ x: 540, y: 540 }, w, h), [540, 540]);
  });

  it('clamps to the centre box the drag shares', () => {
    expect(labelCentreBox(w, h)).toEqual({ x0: 62, x1: 1018, y0: 29.75, y1: 1022.25 });
  });
});

describe('nudge range', () => {
  it('is the whole-pixel dx and dy that keep the pill inside the box, from where the label sits un-nudged', () => {
    expect(nudgeRange({ x: 540.4, y: 500 }, 100, 35.5)).toEqual({ dx: [-478, 477], dy: [-470, 522] });
  });

  it('puts the pill inside the box at both ends', () => {
    const base = { x: 700.37, y: 120.81 };
    const { dx, dy } = nudgeRange(base, 100, 35.5);
    for (const x of dx) for (const y of dy) close(clampLabel({ x: base.x + x, y: base.y + y }, 100, 35.5), [base.x + x, base.y + y]);
  });

  it('comes out inverted for a label wider than the box, which the clamp then pins to the right', () => {
    expect(nudgeRange({ x: 540, y: 500 }, 1100, 35.5).dx).toEqual([22, -22]);
  });
});

describe('leader lines', () => {
  it('are drawn only when the nudge is longer than 6 px', () => {
    expect(hasLeader(0, 0)).toBe(false);
    expect(hasLeader(6, 0)).toBe(false);
    expect(hasLeader(0, -6)).toBe(false);
    expect(hasLeader(6.01, 0)).toBe(true);
    expect(hasLeader(4, 5)).toBe(true);
  });

  it('run from the marker head to the clamped label centre', () => {
    const at = { x: 1000, y: 500 };
    const placed = placeLabel({ kind: 'pin', side: 'right', dx: 16, dy: -46, at, pinSize: 0.9, w: 100, h: 35.5 });
    // Anchor x = 1000 + 72.4 + 16 is clamped to 1068 − 50.
    close(placed, [1018, 500 - 27 - 46]);
    // Where the label sits before the nudge and the clamp: the drag measures its range from here.
    close(placed.base, [1072.4, 473]);
    expect(placed.leader).not.toBeNull();
    close({ x: placed.leader!.x1, y: placed.leader!.y1 }, [1000, 473]);
    close({ x: placed.leader!.x2, y: placed.leader!.y2 }, [1018, 427]);
  });

  it('use the raw nudge for the threshold, not the clamped shift', () => {
    const placed = placeLabel({ kind: 'badge', side: 'right', dx: 5, dy: 0, at: { x: 1060, y: 500 }, pinSize: 0.9, w: 100, h: 35.5 });
    expect(placed.leader).toBeNull();
  });
});

describe('label looks', () => {
  const pal = PALETTES.original;
  it('accent: accent pill on hostels, white pill on attractions, ink text', () => {
    expect(labelLook('accent', 'hostels', pal)).toEqual({ fill: pal.accent, color: pal.ink, halo: false });
    expect(labelLook('accent', 'attractions', pal)).toEqual({ fill: WHITE, color: pal.ink, halo: false });
  });

  it('white: white pill, ink text, on both layers', () => {
    for (const layer of ['hostels', 'attractions'] as const) expect(labelLook('white', layer, pal)).toEqual({ fill: WHITE, color: pal.ink, halo: false });
  });

  it('dark: ink pill, white text, on both layers', () => {
    for (const layer of ['hostels', 'attractions'] as const) expect(labelLook('dark', layer, pal)).toEqual({ fill: pal.ink, color: WHITE, halo: false });
  });

  it('text: no pill, ink text with a white halo, on both layers', () => {
    for (const layer of ['hostels', 'attractions'] as const) expect(labelLook('text', layer, pal)).toEqual({ fill: null, color: pal.ink, halo: true });
  });

  it('follow the palette', () => {
    const teal = PALETTES.brandTeal;
    expect(labelLook('accent', 'hostels', teal)).toEqual({ fill: teal.accent, color: teal.ink, halo: false });
  });
});
