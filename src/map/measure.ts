import type { TextMeasurer } from '../shared/labels';

/* The one place the map reads the DOM: label widths come from the real font
   through canvas measureText. It measures the bare text; the layout adds the
   tracking itself (ls · chars), so the canvas's own letterSpacing stays 0. */

let ctx: CanvasRenderingContext2D | null = null;

export const canvasMeasurer: TextMeasurer = (text, { family, weight, size }) => {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available, so map labels cannot be measured');
  ctx.font = `${weight} ${size}px "${family}"`;
  return ctx.measureText(text).width;
};
