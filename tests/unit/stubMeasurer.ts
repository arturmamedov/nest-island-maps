import type { TextMeasurer } from '../../src/shared/labels.js';

/* A pure stand-in for canvas measureText, so SVG strings built in Node don't
   depend on installed fonts. Shared by every test that renders a map. */

export const stubMeasurer: TextMeasurer = (text, { size }) => [...text].length * size * 0.55;
