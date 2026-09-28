/* What the editor keeps in this browser, and the one way in. Both keys live
   here, in a module with no imports, so the Playwright specs can read the
   same names the app writes. Storage can be missing or throw (private
   windows, blocked site data); every caller copes with `undefined`. */

export const STORAGE_KEYS = {
  /** The preview background: a viewer preference, never map data. */
  previewBackground: 'nest-island-maps.previewBackground',
  /** The autosaved draft: the islands edited since their published seed. */
  draft: 'nest-island-maps.draft',
} as const;

/** window.localStorage, or undefined where even reading it throws (blocked site data). */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
