import iconsFile from '../../data/icons.json';
import { ICON_IDS, IconsFileSchema, type Icon } from './schema.js';

/* The icon set (Lucide, ISC): 24 × 24, stroke-only path data. It stands in
   for the original Photoshop line illustrations until vector originals turn
   up; keep the same { paths[] } shape when adding them. */

export type IconId = (typeof ICON_IDS)[number];

export const ICONS = IconsFileSchema.parse(iconsFile).icons as Record<IconId, Icon>;
export { ICON_IDS };
