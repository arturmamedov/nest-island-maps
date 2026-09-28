# M3: export and the minimal shell

> **Status:** done, 2026-09-28. Written 2026-09-28, after M2.

You are continuing **Nest Island Maps** in `A:\serverpath\laragon\nest-island-maps`, on branch `feat/v1`. It's an internal static site (Vite + React + TypeScript) that draws the Nests Hostels island maps (Tenerife, Gran Canaria, Ibiza) from data and exports them as SVG, PNG, JPG and JSON.

Milestones 1 (scaffold, data, schema) and 2 (layout, renderer, render page, goldens) are done. **Your job is milestone 3:**
- every export: SVG for Figma, SVG for web, Copy SVG, PNG, JPG and Download JSON;
- font embedding for the web SVG and the rasters;
- the minimal editor shell that hosts them;
- a pixel fidelity check of the PNG export.

Export comes before editing because font-embedded rasterising is the riskiest piece.

**Stop when M3 is done.** Don't start data editing, autosave, drag or placing (M4 and M5).

## Read first, in this order

1. `CLAUDE.md` for the non-negotiables and how to work, then `README.md`.
2. `docs/plan-v1.md`, the approved plan. Its decisions 1–14 and the M3 section are binding; decision 7 is the export one.
3. `docs/decisions.md`, especially the "Map" section written in M2. Add every new departure to it.
4. `design_handoff_island_maps/README.md`:
   - §2 for the shell: header, canvas, status line, the preview background setting and the UI tokens;
   - §4 for the exports: formats, filenames, and "export is browser-only".
5. The prototype, as reference only: `design_handoff_island_maps/design/Island Maps.dc.html`. Search it for `cleanSvg`, `embedFonts` and the export buttons. Where it disagrees with the spec, the spec wins, and the prototype's DOM clone-and-strip is replaced by plan decision 6.

## What already exists

- **`src/shared/`** (DOM-free):
  - `tokens.ts`: every number and colour of the artwork, including `ARTBOARD` 1080, `EXPORT_SCALE` 2, `JPEG_QUALITY` 0.92, `WHITE`, `ATTRIBUTION`, `LABEL_FONTS` and `LABEL_FONT_IDS`.
  - `ids.ts`: `ISLAND_IDS` and `LAYERS`. They are JSON-free so Playwright specs can import them; `schema.ts` re-exports both.
  - `schema.ts`: the zod source of truth (`IslandData`, `Settings`, `Geometry`, `Layer`, …).
  - `datafile.ts`: `toDataFile`, `serializeDataFile(data, geometry)` (the Download JSON bytes, identical to a seed) and `parseDataFile`.
  - `islands.ts`: `ISLANDS[id]` → `{ id, name, geometry, seed }`, plus `ISLAND_LIST`.
  - `cluster.ts`, `labels.ts` (the `TextMeasurer` type, pill metrics, anchors, clamp, leaders, label looks) and `layout.ts` (`computeMapLayout(geometry, data, layer, measure)` → rounded primitives).
  - `geo.ts`, `coords.ts`, `icons.ts`.
- **`src/map/`:**
  - `IslandMap.tsx`, **the only renderer**. Its props are `{ geometry, data, layer, measure?, interaction? }`. It also exports the `MapInteraction` type; `interaction` is edit mode and adds only `data-hit` rects and cursor styles.
  - `measure.ts`: `canvasMeasurer`.
  - `fonts.ts`: `loadMapFonts(labelFont, texts)` and `useFontsVersion()`.
  - `fonts.css`: imports the four label faces plus Montserrat 400.
- **`src/export/svg.ts`:** `renderMapSvg({ geometry, data, layer, measure })` is the XML prolog plus `renderToStaticMarkup`, with a line break between tags. It is a pure string function and never renders edit mode (its props type omits `interaction`).
- **The render page:**
  - `render.html` and `src/render/main.tsx`, called as `?island=&layer=`;
  - `window.__MAP_INPUT = { data?, settings? }` through `addInitScript` overrides the data or settings;
  - it sets `__MAP_READY` or `__MAP_ERROR`.
- **`src/editor/main.tsx`** is still the M1 font-specimen placeholder. The shell replaces it.
- **Tests:**
  - 254 vitest unit tests in `tests/unit/`, including `render.test.tsx`. That file holds 11 SVG file snapshots in `tests/unit/__snapshots__/` and the guards: no `#EA580C`, no Nest Pass on Ibiza, layer ids, capitals, no editor markup, and edit markup minus hits equals export markup.
  - 6 Playwright goldens in `tests/render/goldens/*-win32.png`, from `tests/render/golden.spec.ts`.
  - The gates are `npm run typecheck`, `npm test` and `npm run test:render` (build, then Playwright on `vite preview` port 8798).
- **Conventions:**
  - Imports inside `src/shared`, `scripts` and `tests` use `.js` suffixes; `src/map`, `src/editor`, `src/export` and `src/render` import without extensions.
  - A file-top `/* why */` comment, JSDoc on exports, and functional state updates. No ESLint or Prettier.
  - zod 4: object defaults need `.prefault({})`.
  - Windows with PowerShell (Bash also available) and Node 25. `.gitattributes` forces LF.

## Pitfalls already found (M2)

- **React never self-closes** in `renderToStaticMarkup`: an empty element is `<rect …></rect>`. Regexes over markup must match that form.
- **Playwright's ESM loader refuses JSON imports** without an import attribute. Specs must not import `schema.ts` or `islands.ts`; use `ids.ts`, or read files with `fs`.
- **Playwright sanitises `_` to `-`** in snapshot names, so the goldens are `gran-canaria-*-win32.png`.
- **Port 8798:** `reuseExistingServer` is false, so a `vite preview` left running from an earlier session makes `npm run test:render` fail with "already used". Ask the owner to stop it; don't reuse it and don't change the port.
- **Fonts before measuring:** label widths come from canvas `measureText`, so the face must be loaded first (`loadMapFonts`). The live editor re-measures on `useFontsVersion()`. `document.fonts.load` fetches only the subsets whose `unicode-range` meets the sample text, so pass the real, uppercased labels.
- **The renderer does no maths.** Every number is rounded in `layout.ts` (positions 0.1, sizes 0.01). Keep it that way.
- **Gran Canaria's original PNG is drawn at about 1.4×** Tenerife's scale: pill 227 × 50 vs 175 × 35, pin 45 vs 29 px wide, rings about 40 px wider. The defaults match Tenerife. Matching the old GC look is a settings or geometry choice for the owner; don't change the defaults.

## Build

### 1. `src/shared/filename.ts` (TDD)
- `mapFileName(island, layer, ext)` gives `<island>-<hostels|attractions>.<svg|png|jpg>`.
- `dataFileName(island)` gives `<island>-map-data.json` (spec §4).

### 2. `src/map/embedFonts.ts`
- **Build a `<style>` with `@font-face` rules as data URLs** for only the faces a map uses: the current label face at its real weight (`LABEL_FONTS`) and Montserrat 400 (`ATTRIBUTION`).
- **Take the files from `@fontsource`:**
  - Each package has `files/<pkg>-<subset>-<weight>-normal.woff2` and a `unicode.json` (subset → `unicode-range`).
  - Import the woff2 files with `?url`, `fetch` them and base64 them.
  - Copy `unicode-range` from `unicode.json`.
  - Embed only the `latin` and `latin-ext` subsets. `LABEL_CHARSET` guarantees labels need nothing else (`tests/unit/charset.test.ts`).
- **Cache the encoded faces** per font and weight for the session.
- `@font-face` in a `<style>` is font embedding, not element styling, so it doesn't break the presentation-attributes rule.

### 3. `src/export/`
- **`svg.ts`:** keep `renderMapSvg` pure and synchronous (the snapshots use it). Add `renderWebSvg(props)`, which inserts the embedded `<style>` as the first child of `<svg>`; it is async because of the font fetch.
  - The shell must reach `react-dom/server` only through a **dynamic** `import('../export/svg')` at export time, so the editor bundle doesn't carry it. Check the built chunks.
- **`raster.ts`:**
  - web SVG string → Blob URL → `Image` → canvas at `ARTBOARD · EXPORT_SCALE` (2160) → `toBlob`;
  - PNG is transparent;
  - JPG first fills `WHITE`, then draws, at `JPEG_QUALITY`;
  - await `img.decode()` before drawing.
- **`json.ts`:** Download JSON is `serializeDataFile(data, geometry)`. Don't write a second serializer.
- **`download.ts`:** a Blob → object URL → `<a download>` click, then revoke the URL.

### 4. The minimal shell (`src/editor/`)
It replaces the specimen in `main.tsx`; the entry stays `index.html`.
- **`App.tsx`:**
  - The workspace is the three seeds (`ISLANDS[id].seed`) plus the selected island and layer. No editing yet; M4 adds `state.ts`.
  - Functional state updates.
- **`Header`:** the island switcher (Tenerife · Gran Canaria · Ibiza) and the layer switcher (Hostels · Things to do). The Decor tab arrives with its rows in M4.
- **`MapStage`:**
  - one large `<IslandMap>` for the selected map, plus 5 thumbnails of the others, all through the same renderer;
  - the selected map has a 3 px `#53CED1` outline, offset 3, on the HTML wrapper (never in the SVG);
  - a thumbnail click selecting its map is M5;
  - re-measure on `useFontsVersion()`.
- **`ExportBar`:**
  - buttons for SVG (Figma), SVG for web, Copy SVG (`navigator.clipboard.writeText`), PNG, JPG and Download JSON;
  - the note "Figma may drop shadow filters";
  - filenames from `filename.ts`.
- **`StatusLine`:** short confirmations such as "PNG downloaded", which clear after 3.2 s.
- **`prefs.ts`:** the preview background, White or Focus surface (`linear-gradient(to top left, #53CED1, #0D6F82 50%, #083344)`).
  - It is kept in `localStorage` as a viewer preference and is never part of the map or the export.
  - Wrap storage access in try/catch.
- **`editor.css`:** apply the UI tokens from spec §2:
  - Montserrat for the UI, Poppins 700 for titles, and the slate text colours;
  - primary buttons `#0D6F82` (hover `#083344`), outline buttons with a 2 px `#53CED1` border;
  - the active tab in `#0D6F82`;
  - hover `scale(1.03–1.1)` over 300 ms.

## Tests to write

**Unit** (`tests/unit/`):
- **Filenames:** all 3 islands × 2 layers × 3 formats, plus the JSON name.
- **The Figma SVG** has `xmlns`, the 1080 size, capitals, the attribution, every layer id, and no `data-hit`, `cursor` or `<style>`.
- **The web SVG** equals the Figma SVG plus exactly one `<style>` holding `@font-face` rules for the label face and Montserrat 400, latin and latin-ext only. Stub the font bytes behind one injectable function so this runs in Node.
- **Download JSON** equals the seed file bytes for all 3 islands (`readFileSync('data/seed/<id>.json')`).

**Playwright** (`tests/render/export.spec.ts`), on the shell (`/index.html`):
- **Fidelity:**
  - Click PNG and capture the download.
  - Separately, screenshot the render page's SVG at `deviceScaleFactor: 2` with `omitBackground` (in a new context).
  - `pixelmatch` (threshold 0.1) must report under 0.5 % differing pixels.
  - This compares two live buffers and commits nothing (plan decision 11).
- **The PNG** is 2160 × 2160 with transparent corners. **The JPG** is 2160 × 2160 with white corners.
- **Download JSON** equals the seed bytes.

## Definition of done

1. `npm run typecheck`, `npm test` and `npm run test:render` all pass, and `npm run gen` reports everything up to date.
2. In the running app (`npm run dev`, or the built preview), export SVG, web SVG, PNG and JPG for Tenerife Hostels and for one Ibiza map. **Open each file in Chrome and look at it:**
   - fonts are the real faces, not fallbacks;
   - the shadow is present, the rings are transparent in the PNG, and the JPG is white.
3. Compare the exported Tenerife PNG with `tests/render/goldens/tenerife-hostels-win32.png` and `design_handoff_island_maps/reference/original-tenerife.png`, and report any difference beyond those listed in `docs/decisions.md`.
4. The editor's built main chunk doesn't contain `react-dom/server`.
5. `docs/decisions.md` records every new departure, and `docs/plan-v1.md` marks M3 done.

## Then stop

- **Report to the owner, concisely:** what was built, test counts, what the exported files showed, and any decision you had to take.
- **Write the next brief** as `docs/prompts/m4-editing.md`, in the same standalone style: data editing and persistence, per the plan. Set this file's status to `done, <date>`.
- **Git:**
  - Commit only when the owner asks. When asked, commit logically: small self-contained commits, sentence-style subjects, bulleted bodies ending with the Co-Authored-By trailer.
  - Never push.
- **Owner's standing rules:**
  - SOLID and DRY, with one source of truth per fact.
  - Never invent hostel names.
  - "© OpenStreetMap contributors" stays on every map and every export.
  - No Nest Pass content on Ibiza.
  - Orange `#EA580C` is never map ink.
