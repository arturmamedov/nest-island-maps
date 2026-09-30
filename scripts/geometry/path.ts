import type { Point } from '../../src/shared/geo.js';

/* SVG path data exactly as the committed geometry files hold it
   (tools/build-island.js line 26): one closed polygon, one decimal per number,
   no repeated closing vertex. */

/** A closed polygon as `M x y L x y … Z`, every number with exactly one decimal. */
export const toD = (pts: readonly Point[]): string => 'M' + pts.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join('L') + 'Z';
