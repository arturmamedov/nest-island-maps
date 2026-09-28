import { useCallback, useState } from 'react';
import { WHITE } from '../shared/tokens';

/* The preview background (spec §2 settings: "preview only, never exported")
   is a viewer preference, not map data: it lives in this browser's
   localStorage and never reaches an island file or an export. Storage can be
   missing, hold junk or throw (private windows, blocked site data), so every
   access is guarded and the editor falls back to White. */

export const PREVIEW_BACKGROUNDS = {
  white: WHITE,
  focus: 'linear-gradient(to top left, #53CED1, #0D6F82 50%, #083344)',
} as const;
export type PreviewBackground = keyof typeof PREVIEW_BACKGROUNDS;

export const PREVIEW_BACKGROUND_LABELS: Record<PreviewBackground, string> = { white: 'White', focus: 'Focus surface' };

const KEY = 'nest-island-maps.previewBackground';

const isPreviewBackground = (v: string | null | undefined): v is PreviewBackground => !!v && Object.hasOwn(PREVIEW_BACKGROUNDS, v);

/** The stored choice, or White when there is none or it can't be read. */
export function loadPreviewBackground(storage: Storage | undefined): PreviewBackground {
  try {
    const v = storage?.getItem(KEY);
    return isPreviewBackground(v) ? v : 'white';
  } catch {
    return 'white';
  }
}

/** Stores the choice; a storage that refuses it only costs the memory. */
export function savePreviewBackground(storage: Storage | undefined, value: PreviewBackground): void {
  try {
    storage?.setItem(KEY, value);
  } catch {
    // Not remembered across reloads, which is harmless.
  }
}

// Even reading window.localStorage can throw when site data is blocked.
function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The preview background and its setter, remembered in this browser. */
export function usePreviewBackground(): [PreviewBackground, (value: PreviewBackground) => void] {
  const [background, setBackground] = useState(() => loadPreviewBackground(browserStorage()));
  const choose = useCallback((value: PreviewBackground) => {
    setBackground(value);
    savePreviewBackground(browserStorage(), value);
  }, []);
  return [background, choose];
}
