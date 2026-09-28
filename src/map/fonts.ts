import { useEffect, useState } from 'react';
import { ATTRIBUTION, LABEL_FONTS, LABEL_SIZE, type LabelFontId } from '../shared/tokens';

/* Label widths are measured, so the label face must be loaded before a map
   is measured, or the pills take the fallback font's width. @font-face only
   downloads on use, and only the unicode-range subsets the text needs, so
   load each face at its real weight with the real (uppercased) text. */

/** Loads the label face and the attribution face for these label texts, then waits for every pending font. */
export async function loadMapFonts(labelFont: LabelFontId, texts: readonly string[]): Promise<void> {
  const { family, weight } = LABEL_FONTS[labelFont];
  const sample = texts.map((t) => t.toUpperCase()).join(' ') || 'A';
  await Promise.all([
    document.fonts.load(`${weight} ${LABEL_SIZE.default}px "${family}"`, sample),
    document.fonts.load(`${ATTRIBUTION.weight} ${ATTRIBUTION.size}px "${ATTRIBUTION.family}"`, ATTRIBUTION.text),
  ]);
  await document.fonts.ready;
}

/** Bumps whenever the browser finishes loading fonts, so a live map re-measures its labels. */
export function useFontsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    document.fonts.addEventListener('loadingdone', bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);
  return version;
}
