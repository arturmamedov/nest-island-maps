/* The islands and the two maps drawn from each. They live apart from
   schema.ts because this module imports no JSON: Playwright's ESM loader
   refuses JSON imports without an import attribute, and the render tests
   must enumerate the same lists as the app. schema.ts re-exports the lists
   its enums are built from. */

export const ISLAND_IDS = ['tenerife', 'gran_canaria', 'ibiza'] as const;

/** The two maps drawn from each island file. Decor is shared between them. */
export const LAYERS = ['hostels', 'attractions'] as const;

/** What the editor calls each map; "Things to do" is the spec's name for the attractions map. */
export const LAYER_LABELS = { hostels: 'Hostels', attractions: 'Things to do' } as const satisfies Record<(typeof LAYERS)[number], string>;

/** The editor's list tabs: one per map, plus Decor (icons and routes, shared by both maps). */
export const TABS = [...LAYERS, 'decor'] as const;
export const TAB_LABELS = { ...LAYER_LABELS, decor: 'Decor' } as const satisfies Record<(typeof TABS)[number], string>;

/** Which maps a decor icon or route appears on, in the prototype's cycle order: Both maps → Hostels → Things to do. */
export const SHOW_ON = ['both', ...LAYERS] as const;
export const SHOW_ON_LABELS = { both: 'Both maps', ...LAYER_LABELS } as const satisfies Record<(typeof SHOW_ON)[number], string>;
