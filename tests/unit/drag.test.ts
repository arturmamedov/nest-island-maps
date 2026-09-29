import { describe, expect, it } from 'vitest';
import { artboardScale, decorTarget, DRAG_THRESHOLD, isDrag, nudgeFor, toArtboard } from '../../src/editor/drag.js';
import { latLngAt } from '../../src/shared/coords.js';
import { project } from '../../src/shared/geo.js';
import { ISLANDS } from '../../src/shared/islands.js';

/* The drag maths of M5 (spec §2 "Dragging", plan M5): a press becomes a drag
   only past 3 screen pixels, screen pixels become artboard pixels by
   1080 / rendered width, a label's nudge stays whole and inside the box, and a
   decor icon's centre stays on the artboard. */

describe('the threshold', () => {
  it('is 3 screen pixels: a press that moves less is a click, never a drag', () => {
    expect(DRAG_THRESHOLD).toBe(3);
    expect(isDrag(0, 0)).toBe(false);
    expect(isDrag(2, 2)).toBe(false);
    expect(isDrag(2.99, 0)).toBe(false);
    expect(isDrag(3, 0)).toBe(true);
    expect(isDrag(0, -3)).toBe(true);
    expect(isDrag(2.2, -2.2)).toBe(true);
  });
});

describe('screen to artboard', () => {
  it('scales by 1080 / the rendered width of the map', () => {
    expect(artboardScale(1080)).toBe(1);
    expect(artboardScale(758)).toBeCloseTo(1.4248, 4);
    expect(artboardScale(540)).toBe(2);
  });

  it('maps a client position on the map to the artboard', () => {
    const rect = { left: 161, top: 92, width: 758 };
    expect(toArtboard({ x: 161 + 379, y: 92 + 379 }, rect)).toEqual({ x: 540, y: 540 });
    expect(toArtboard({ x: 161, y: 92 }, rect)).toEqual({ x: 0, y: 0 });
    const p = toArtboard({ x: 300, y: 500 }, rect);
    expect(p.x).toBeCloseTo((300 - 161) * (1080 / 758), 9);
    expect(p.y).toBeCloseTo((500 - 92) * (1080 / 758), 9);
  });
});

describe('the label nudge', () => {
  const wide = { dx: [-478, 477], dy: [-470, 522] } as { dx: [number, number]; dy: [number, number] };

  it('adds the drag to the start and keeps whole pixels', () => {
    expect(nudgeFor({ dx: 16, dy: 0 }, { x: 40.6, y: -0.4 }, wide)).toEqual({ dx: 57, dy: 0 });
    expect(nudgeFor({ dx: 0, dy: 0 }, { x: -12.5, y: 7.49 }, wide)).toEqual({ dx: -12, dy: 7 });
  });

  it('clamps to the range that keeps the pill inside the box', () => {
    expect(nudgeFor({ dx: 0, dy: 0 }, { x: 2000, y: -2000 }, wide)).toEqual({ dx: 477, dy: -470 });
    expect(nudgeFor({ dx: 0, dy: 0 }, { x: -2000, y: 2000 }, wide)).toEqual({ dx: -478, dy: 522 });
  });

  it('never snaps a nudge that already lies outside the range: the range stretches to the start', () => {
    const range = { dx: [-478, 477], dy: [-470, 522] } as typeof wide;
    expect(nudgeFor({ dx: -500, dy: 0 }, { x: -10, y: 0 }, range)).toEqual({ dx: -500, dy: 0 });
    expect(nudgeFor({ dx: -500, dy: 0 }, { x: 5, y: 0 }, range)).toEqual({ dx: -495, dy: 0 });
  });

  it('leaves a label wider than the box where it was on that axis, as the clamp pins it', () => {
    expect(nudgeFor({ dx: 0, dy: 0 }, { x: 50, y: 3 }, { dx: [22, -22], dy: [-10, 10] })).toEqual({ dx: 0, dy: 3 });
    // Off-centre, the inverted range lies on one side: still no nudge, so no leader the drawing wouldn't explain.
    expect(nudgeFor({ dx: 0, dy: 0 }, { x: 50, y: 3 }, { dx: [312, 168], dy: [-10, 10] })).toEqual({ dx: 0, dy: 3 });
    expect(nudgeFor({ dx: 4, dy: 0 }, { x: -50, y: 0 }, { dx: [-308, -452], dy: [-10, 10] })).toEqual({ dx: 4, dy: 0 });
  });
});

describe('the decor target', () => {
  it('is the start plus the drag, kept half a pixel inside the artboard', () => {
    expect(decorTarget({ x: 100, y: 200 }, { x: 10.5, y: -5 })).toEqual({ x: 110.5, y: 195 });
    expect(decorTarget({ x: 5, y: 1075 }, { x: -20, y: 20 })).toEqual({ x: 0.5, y: 1079.5 });
  });

  it('round-trips through lat/lng to within 0.01 px', () => {
    const { projection } = ISLANDS.tenerife.geometry;
    const sun = ISLANDS.tenerife.seed.decor.find((d) => d.id === 'sun')!;
    const target = decorTarget(project(projection, sun.lat, sun.lng), { x: 42.7, y: -18.2 });
    const moved = latLngAt(projection, target);
    const back = project(projection, moved.lat, moved.lng);
    expect(Math.abs(back.x - target.x)).toBeLessThan(0.01);
    expect(Math.abs(back.y - target.y)).toBeLessThan(0.01);
  });
});
