/* Every fixed number and colour of the map artwork (handoff README §1), in one
   place. The artwork is final and matched to the owner's Photoshop settings,
   so change a value here only together with the spec. */

export const ARTBOARD = 1080;
/** PNG/JPG are the same SVG rasterised at twice the artboard (2160 × 2160). */
export const EXPORT_SCALE = 2;
export const JPEG_QUALITY = 0.92;

export const PALETTE_IDS = ['original', 'brandTeal'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

/* "Original" was sampled from the brand PNGs; "Brand teal" uses design-system
   tokens only. Orange #EA580C (the website's Book Now) is never map ink. */
export const PALETTES: Record<PaletteId, { land: [string, string]; halo: [string, string]; ink: string; accent: string }> = {
  original: { land: ['#7FCECF', '#98D6C8'], halo: ['#35434E', '#475B70'], ink: '#394755', accent: '#FEB700' },
  brandTeal: { land: ['#53CED1', '#309EAA'], halo: ['#083344', '#0D6F82'], ink: '#083344', accent: '#FFDE59' },
};
export const WHITE = '#FFFFFF';
export const FORBIDDEN_INK = '#EA580C';

/** Fill opacity of ring-1 (innermost) … ring-4. Stacked they composite to 1 / 0.72 / 0.44 / 0.2. */
export const RING_OPACITY = [1, 0.5, 0.3, 0.2] as const;
export const RING_COUNT = RING_OPACITY.length;
/** Decor turns white where the rings behind it are at least this opaque (ring-1…ring-3 when all show). */
export const ON_DARK_ALPHA = 0.44;
export const COAST_STROKE = 9;

/** Photoshop "Ombra esterna": black 25 %, distance 0, spread 5 %, size 9 px. */
export const SHADOW = { opacity: 0.25, dilate: 0.5, blur: 4.5 } as const;

/* Hostel pin: tip at 0,0, head centre 0,−30, radius 16, hole radius 7. The hole
   is transparent so it shows the teal land or the dark ring underneath. */
export const PIN_PATH = 'M0 0C-4.5-9-16-17.5-16-30A16 16 0 1 1 16-30C16-17.5 4.5-9 0 0ZM7-30A7 7 0 1 0-7-30A7 7 0 1 0 7-30Z';
export const PIN = { headY: -30, headR: 16, top: 46 } as const;
export const PIN_SIZE_DEFAULT = 0.9;
export const DOT = { outerR: 11, innerR: 5 } as const;
export const BADGE = { r: 22, stroke: 3, iconSize: 26, iconStroke: 1.9 } as const;
export const ICON_BOX = 24;
/** Decor strokes stay this wide on screen whatever the icon size. */
export const DECOR_STROKE = 2.6;
export const DECOR_SIZE = { min: 20, max: 140 } as const;

export const CLUSTER_PX = 14;
export const LABEL_GAP = 8;
/** The label centre is clamped so the pill stays inside this box. */
export const LABEL_BOX = { x0: 12, x1: 1068, y0: 12, y1: 1040 } as const;
export const LEADER = { minOffset: 6, width: 2.5 } as const;
export const ROUTE = { width: 2.5, dash: '7 7', opacity: 0.85 } as const;

/* ODbL: this credit stays on every published map. */
export const ATTRIBUTION = {
  text: '© OpenStreetMap contributors',
  x: 1062,
  y: 1064,
  family: 'Montserrat',
  weight: 400,
  size: 14,
  opacity: 0.55,
} as const;

export const LABEL_FONT_IDS = ['robotoCondensed', 'poppins', 'montserrat', 'archivoBlack'] as const;
export type LabelFontId = (typeof LABEL_FONT_IDS)[number];

/* Roboto Condensed is the Photoshop original (Bold 25 pt, tracking 190). The
   wider faces need a taller, squarer pill, hence `condensed`. */
export const LABEL_FONTS: Record<LabelFontId, { family: string; weight: number; condensed: boolean }> = {
  robotoCondensed: { family: 'Roboto Condensed', weight: 700, condensed: true },
  poppins: { family: 'Poppins', weight: 600, condensed: false },
  montserrat: { family: 'Montserrat', weight: 700, condensed: false },
  archivoBlack: { family: 'Archivo Black', weight: 400, condensed: false },
};

/** Pill metrics as multiples of the font size (radius as a multiple of the height). */
export const PILL = {
  condensed: { height: 1.42, padX: 0.55, radius: 0.5 },
  wide: { height: 1.7, padX: 0.75, radius: 0.3 },
} as const;
/** Baseline for vertically centred caps; Figma ignores dominant-baseline. */
export const TEXT_BASELINE = 0.36;
/** "Text only" style: white halo width as a multiple of the font size. */
export const TEXT_HALO = 0.32;

export const LABEL_SIZE = { min: 14, max: 36, default: 25 } as const;
export const LABEL_TRACKING = { min: 0, max: 0.3, default: 0.19 } as const;
export const PIN_SIZE = { min: 0.6, max: 1.4, default: PIN_SIZE_DEFAULT } as const;

/* What a label may contain: the printable part of the latin + latin-ext subsets
   every label font ships (tests/unit/charset.test.ts proves the coverage and
   that uppercasing never leaves the set). Anything else would render in a
   fallback font on the PNG. */
export const LABEL_CHARSET =
  /^[ -~ -´¶-ňŊ-ƚƜ-ǯǱ-ȾɁ-ɏ‐-‧€]*$/;
export const LABEL_MAX = 40;

/** The Ibiza firewall: no Nest Pass content on any Ibiza map. */
export const NEST_PASS = /nest\s*pass/i;
