# Decisions

Where the app deliberately differs from the handoff prototype (`design_handoff_island_maps/design/`), or settles something the spec leaves open. The spec (`design_handoff_island_maps/README.md`) wins over the prototype unless a line here says otherwise.

## Data

- **Labels are stored as typed** (mixed case, accents) and uppercased in JS at render time, never with CSS. The exported SVG carries capitals. This was the owner's choice, and CLAUDE.md says the same.
- **One `settings` object per island file**, shared by that island's two maps (Hostels and Things to do). It is saved and exported, so a file reproduces both maps. The prototype kept settings global and never saved them.
- **The seed file and "Download data (JSON)" are the same bytes.** `npm run gen` rewrites `data/seed/*.json` in that canonical form: 2-space JSON, LF, a trailing newline, the spec's key order, plus `artboard`, `projection` and `settings`. Publishing is: download, put the file in `data/seed/`, commit.
  - `projection` is a copy of the geometry file's, written for the WordPress theme. The app always reads the projection from `data/geometry/`, and import refuses a file whose projection doesn't match.
- **Hostel identity:**
  - `data/hostels.json` is derived from the flyers repo's `seed/hostels.json` (`npm run sync:hostels`).
  - The schema only accepts those slugs, each on its own island. Adding a hostel means picking one of them; the prototype's free-form "New Nest" is gone.
- **Label charset:** labels may only use characters from the latin + latin-ext subsets that every label font ships (`LABEL_CHARSET`). They are NFC-normalised, so a pasted "e + combining accent" becomes "é".
- **Ibiza firewall:** the schema refuses any string matching `/nest\s*pass/i` in Ibiza data.

## Coordinates

- The "Lat, lng" input refuses Google Maps links, whose `@` numbers are the viewport and not the pin, and refuses points that project off the artboard (usually lat and lng swapped).

## Map

- **Clustering is single linkage.** Hostels share a pin when a chain of neighbours closer than 14 px links them (union-find over every pair), so the result never depends on list order. The prototype's greedy pass did. Only visible hostels take part; attractions never cluster. The pin sits at the members' mean, and its id is `pin-<first member in data order>`.
- **Routes run between cluster pins,** tip to tip. A route whose two hostels share one pin is not drawn. The prototype used the raw hostel points.
- **Label numbers follow the spec, not the prototype:**
  - tracking is `fs·0.19` = 4.75 (the prototype used 4.8);
  - the pill height, padding and radius are not rounded, and the fonts load at their real weights.
- **Rounding happens once, in the layout:** positions to 0.1 px; sizes, scales and widths to 0.01.
  - The pill's half-width and half-height are rounded, so the rect stays centred.
  - The badge icon's scale is therefore 1.08 (the spec writes 1.0833), a 0.08 px difference.
- **Decor colour uses the true composite of the rings shown:** `1 − Π(1 − opacity)` over the shown rings under the icon, white from 0.44. The prototype read the innermost ring's zone alpha, so at 3 rings it drew ring-3 decor white over a ring that is only 0.3 opaque; the app draws it ink.
- **The dot's label anchor scales with pinSize** (`r = 11·ps`), because the dot is drawn scaled by pinSize like the pin. The spec gives a flat r 11.
- **"Text only" draws no rect at all.** The prototype drew an empty one.
- **Defs ids are prefixed per map** (`${island}-${layer}-halo|land|shadow`), so two maps inlined in one page don't share gradients. Layer ids stay bare because they become Figma layer names.
- **Presentation attributes only, never `style`.** `font-family` is unquoted (`Roboto Condensed, sans-serif`) because React escapes quotes. Every path is inline.
- **`halo-rings` is always present,** even at 0 rings. `decor` is omitted when it has nothing to draw.
- **The SVG file is the renderer's own static markup** (`renderToStaticMarkup`), with a line break between tags. Edit mode is the `interaction` prop and adds only transparent `data-hit` rects and cursor styles; a test holds the rest byte-identical.
- **Markers are stable-sorted by y** on their exact position, so ties keep data order.
- **`ISLAND_IDS` and `LAYERS` live in `src/shared/ids.ts`,** re-exported by `schema.ts`. Playwright's ESM loader refuses `schema.ts`'s JSON imports, and the render tests must enumerate the same lists as the app. `LAYER_LABELS` (Hostels, Things to do) sits beside them for the same reason.

## Export

- **Two SVG downloads where the spec has one.**
  - **"SVG (Figma)"** is `renderMapSvg`, with no fonts: Figma and Illustrator draw with the faces installed on the designer's machine.
  - **"SVG for web"** is the same file plus one `<style>` of `@font-face` data URLs, as the first child of `<svg>`. An SVG shown through `<img>`, or opened on its own, can't see a page's fonts.
  - The owner chose separate names (2026-09-28): `<island>-<layer>.svg` and `<island>-<layer>-web.svg`, so the two files never collide.
- **Only what a map draws is embedded:** the current label face at its real weight, and Montserrat 400 for the attribution. Each comes in the latin and latin-ext subsets, since `LABEL_CHARSET` keeps labels inside them.
  - The bytes are the self-hosted `@fontsource` woff2 files, fetched and base64-encoded. `unicode-range` comes from each package's `unicode.json`.
  - Each face is encoded once per session. A failed fetch is forgotten, so the next export retries.
  - The prototype inlined every subset Google Fonts returned.
- **PNG and JPG rasterise the web SVG:** Blob URL → `<img>` → `decode()` → canvas at 2160. The JPG fills white first and uses quality 0.92. No `modern-screenshot`.
- **Installed fonts can hide a missing embedding.** The owner's machine has all four label faces and Montserrat installed, and an SVG in an `<img>` may draw with those. So `tests/render/export.spec.ts` also renames every family, in the rules and the text alike. The web SVG must still match Chromium's own rendering, and without its `<style>` it must not.
- **The PNG fidelity check covers all six maps,** not only Tenerife Hostels. At M3 each differed from Chromium's DPR-2 screenshot by 0–6 pixels out of 4.67 million.
- **Copy SVG copies the Figma SVG,** which pastes into Figma or code, as in the prototype, and carries no base64 fonts. The Windows clipboard stores it with CRLF line ends.
- **Download JSON is `serializeDataFile`,** so it is the seed's bytes, with no second serializer.
- **`react-dom/server` stays out of the editor's first load.** `src/export/svg.ts` is imported dynamically when an export runs. `tests/render/bundle.spec.ts` follows the entry script's static imports and holds this.
- **A download's object URL is revoked after 1.5 s,** as in the prototype, not during the click. Revoking it then can cancel the download.
- **Status messages** keep the prototype's wording, with these changes:
  - added "Web SVG downloaded";
  - the clipboard fallback names the real button ("use SVG (Figma) instead");
  - failures read "Export failed: <reason>". The prototype blamed the connection because it fetched Google Fonts; the fonts here are self-hosted.

## Editor shell

- **Layout:**
  - a header with the island switcher, the map tabs (with visible counts, as in the prototype) and the preview background;
  - the stage, with the selected map large and the other five as thumbnails, all drawn by `IslandMap`;
  - a side panel of about 460 px with the exports and the status line.
  - Clicking a thumbnail to select it is M5.
- **The preview background sits in the header until M4's settings panel exists.** It is a per-browser preference in `localStorage` (`nest-island-maps.previewBackground`), never in the island data or an export. It falls back to White when storage is missing or throws.
- **The selection outline and the preview background go on the HTML wrapper,** never in the SVG, so neither can reach an export.
- **The stage re-measures in two cases:** on `useFontsVersion()`, and once `loadMapFonts` has resolved for every island. A face can finish loading before the `loadingdone` listener is attached.
- **Switchers:** the island switcher is the prototype's segmented control (a white active pill). The map tabs use the spec's active tab, `#0D6F82` with white text.
- **Hover:** controls grow by 1.04 over 300 ms, inside the spec's 1.03–1.1. There is no motion under `prefers-reduced-motion`.
