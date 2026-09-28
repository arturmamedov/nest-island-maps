import archivoBlackLatin from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url';
import archivoBlackLatinExt from '@fontsource/archivo-black/files/archivo-black-latin-ext-400-normal.woff2?url';
import archivoBlackUnicode from '@fontsource/archivo-black/unicode.json';
import montserratLatin400 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff2?url';
import montserratLatin700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import montserratLatinExt400 from '@fontsource/montserrat/files/montserrat-latin-ext-400-normal.woff2?url';
import montserratLatinExt700 from '@fontsource/montserrat/files/montserrat-latin-ext-700-normal.woff2?url';
import montserratUnicode from '@fontsource/montserrat/unicode.json';
import poppinsLatin from '@fontsource/poppins/files/poppins-latin-600-normal.woff2?url';
import poppinsLatinExt from '@fontsource/poppins/files/poppins-latin-ext-600-normal.woff2?url';
import poppinsUnicode from '@fontsource/poppins/unicode.json';
import robotoCondensedLatin from '@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2?url';
import robotoCondensedLatinExt from '@fontsource/roboto-condensed/files/roboto-condensed-latin-ext-700-normal.woff2?url';
import robotoCondensedUnicode from '@fontsource/roboto-condensed/unicode.json';
import { ATTRIBUTION, LABEL_FONTS, type LabelFontId } from '../shared/tokens';

/* An SVG drawn through <img> (the PNG/JPG path) or opened on its own cannot
   see the page's fonts, so the web SVG carries its faces as data URLs in a
   <style>. That is font embedding, not element styling: the map's elements
   keep presentation attributes only.

   Only what a map draws is embedded: the current label face at its real
   weight and Montserrat 400 for the attribution, in the latin and latin-ext
   subsets. LABEL_CHARSET keeps labels inside those two (charset.test.ts), so
   no glyph can fall back. The files are the same self-hosted @fontsource
   woff2 the page uses, so the export needs no network beyond this site. */

const SUBSETS = ['latin', 'latin-ext'] as const;
type Subset = (typeof SUBSETS)[number];
type PerSubset = Record<Subset, string>;

/** One face as the export embeds it: its woff2 URL and unicode-range per subset. */
export type EmbeddedFace = { family: string; weight: number; files: PerSubset; unicode: PerSubset };

const face = ({ family, weight }: { family: string; weight: number }, unicode: PerSubset, latin: string, latinExt: string): EmbeddedFace => ({
  family,
  weight,
  unicode: { latin: unicode.latin, 'latin-ext': unicode['latin-ext'] },
  files: { latin, 'latin-ext': latinExt },
});

/** Family and weight come from tokens.ts; only the file for each lives here. */
export const EMBEDDED_FACES = {
  robotoCondensed: face(LABEL_FONTS.robotoCondensed, robotoCondensedUnicode, robotoCondensedLatin, robotoCondensedLatinExt),
  poppins: face(LABEL_FONTS.poppins, poppinsUnicode, poppinsLatin, poppinsLatinExt),
  montserrat: face(LABEL_FONTS.montserrat, montserratUnicode, montserratLatin700, montserratLatinExt700),
  archivoBlack: face(LABEL_FONTS.archivoBlack, archivoBlackUnicode, archivoBlackLatin, archivoBlackLatinExt),
  attribution: face(ATTRIBUTION, montserratUnicode, montserratLatin400, montserratLatinExt400),
} satisfies Record<LabelFontId | 'attribution', EmbeddedFace>;

/** Reads a font file's bytes; injected so the embedding can be tested in Node. */
export type FetchFontBytes = (url: string) => Promise<ArrayBuffer>;

export type FontEmbedder = {
  /** The @font-face rules for a map with this label font: the label face plus the attribution face. */
  css(labelFont: LabelFontId): Promise<string>;
};

const fetchFont: FetchFontBytes = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load the font file ${url} (HTTP ${r.status})`);
  return r.arrayBuffer();
};

/** An embedder with its own cache: each face is fetched and encoded once for the session. */
export function createFontEmbedder(fetchBytes: FetchFontBytes = fetchFont): FontEmbedder {
  const cache = new Map<string, Promise<string>>();

  const rulesFor = (f: EmbeddedFace): Promise<string> => {
    const key = `${f.family} ${f.weight}`;
    let rules = cache.get(key);
    if (!rules) {
      rules = encodeFace(f, fetchBytes);
      cache.set(key, rules);
      // A failed fetch must not stick for the session: the next export retries.
      rules.catch(() => cache.delete(key));
    }
    return rules;
  };

  return {
    async css(labelFont) {
      const parts = await Promise.all([rulesFor(EMBEDDED_FACES[labelFont]), rulesFor(EMBEDDED_FACES.attribution)]);
      return parts.join('');
    },
  };
}

/** The app's embedder. */
export const fontEmbedder = createFontEmbedder();

async function encodeFace(f: EmbeddedFace, fetchBytes: FetchFontBytes): Promise<string> {
  const rules = await Promise.all(
    SUBSETS.map(async (subset) => {
      const base64 = bytesToBase64(new Uint8Array(await fetchBytes(f.files[subset])));
      return (
        `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};` +
        `src:url(data:font/woff2;base64,${base64}) format("woff2");unicode-range:${f.unicode[subset]}}`
      );
    }),
  );
  return rules.join('');
}

/* btoa takes a binary string; building it in chunks keeps the spread under
   the engine's argument limit for fonts of any size. */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}
