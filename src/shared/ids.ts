/* The islands and the two maps drawn from each. They live apart from
   schema.ts because this module imports no JSON: Playwright's ESM loader
   refuses JSON imports without an import attribute, and the render tests
   must enumerate the same lists as the app. schema.ts re-exports both. */

export const ISLAND_IDS = ['tenerife', 'gran_canaria', 'ibiza'] as const;

/** The two maps drawn from each island file. Decor is shared between them. */
export const LAYERS = ['hostels', 'attractions'] as const;

/** What the editor calls each map; "Things to do" is the spec's name for the attractions map. */
export const LAYER_LABELS = { hostels: 'Hostels', attractions: 'Things to do' } as const satisfies Record<(typeof LAYERS)[number], string>;
