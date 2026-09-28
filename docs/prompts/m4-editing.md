# M4: data editing and persistence

> **Status:** open. Written 2026-09-28, after M3.

You are continuing **Nest Island Maps** in `A:\serverpath\laragon\nest-island-maps`, on branch `feat/v1`. It's an internal static site (Vite + React + TypeScript) that draws the Nests Hostels island maps (Tenerife, Gran Canaria, Ibiza) from data and exports them as SVG, PNG, JPG and JSON.

Milestones 1 (scaffold, data, schema), 2 (layout, renderer, render page, goldens) and 3 (every export, font embedding, the minimal shell) are done. **Your job is milestone 4:**
- editing the data: the hostel, things-to-do, decor and route rows;
- the settings panel;
- persistence: the localStorage autosave with its stale-draft warning, Import JSON and Reset island.

**Stop when M4 is done.** Don't start drag, click-to-place or selecting a map by its thumbnail (M5), or the geometry pipeline (M6).

## Read first, in this order

1. `CLAUDE.md` for the non-negotiables and how to work, then `README.md`.
2. `docs/plan-v1.md`, the approved plan. Its decisions are binding, above all:
   - 3, never invent hostels;
   - 9, stale drafts;
   - 12, reset asks first;
   - 13, the coordinates input.
   The M4 section lists the work and the tests.
3. `docs/decisions.md`: all of it, especially "Data", "Coordinates", "Editor shell" and "Export". Add every new departure to it.
4. `design_handoff_island_maps/README.md`:
   - §2 for the rows ("Interactions"), the settings table and the UI tokens;
   - §3 for the data model.
5. The prototype, as reference only: `design_handoff_island_maps/design/Island Maps.dc.html`, turn 2. Search it for the row markup and copy, for example `Add row`, `Add route`, `back to defaults` and `Show on`. Where it disagrees with the spec or the plan, they win.

## What already exists

- **`src/shared/`** (DOM-free):
  - `tokens.ts`: every number and colour, including the setting ranges `LABEL_SIZE`, `LABEL_TRACKING`, `PIN_SIZE`, `DECOR_SIZE` and `RING_COUNT`, plus `LABEL_CHARSET`, `LABEL_MAX` and `NEST_PASS`.
  - `ids.ts`: `ISLAND_IDS`, `LAYERS` and `LAYER_LABELS`. They are JSON-free, so Playwright can import them.
  - `schema.ts`: the zod source of truth. It holds `IslandDataSchema` with its refinements:
    - a hostel must be on its own island;
    - ids and slugs are unique;
    - route ends must be on the map and differ;
    - the Ibiza firewall.
    Labels are trimmed and NFC-normalised, 1–40 characters, and must stay inside `LABEL_CHARSET`. `SettingsSchema` holds 9 settings; the preview background is not one of them.
  - `datafile.ts`: `serializeDataFile` (the seed bytes) and `parseDataFile(json, { id, geometry })`, which gives `{ ok, data } | { ok: false, error }`. It refuses another island's file and a mismatched projection. This is the Import path.
  - `islands.ts`: `ISLANDS[id]` → `{ id, name, geometry, seed }`, plus `ISLAND_LIST`.
  - `coords.ts`: `parseCoords(text, projection?)`. It gives a friendly error for a Maps link, for a bad pair, and for a point off the artboard. `formatCoords` is the reverse.
  - `geo.ts`: `project`, `unproject`, `parsePolygons` and `pointInPolygons`, for the "in the sea" badge. `puerto-nest` and `las-eras-nest` are in the sea today.
  - `cluster.ts`, `labels.ts`, `layout.ts`, `icons.ts` (`ICONS`, `ICON_IDS`) and `filename.ts`.
- **`src/map/`:**
  - `IslandMap.tsx`, the only renderer. Its props are `{ geometry, data, layer, measure?, interaction? }`, where `interaction` is M5's edit mode.
  - `measure.ts`, `fonts.ts` (`loadMapFonts`, `useFontsVersion`), `fonts.css` and `embedFonts.ts`.
- **`src/export/`:**
  - `svg.ts`: `renderMapSvg` and `renderWebSvg`. Only this file reaches `react-dom/server`, and the editor must import it dynamically.
  - `raster.ts`, `json.ts` (`dataFileBlob`) and `download.ts` (`downloadBlob`).
- **`src/editor/`:**
  - `main.tsx`.
  - `App.tsx`: the state `{ workspace, island, layer }` with functional updates, laid out as Header, MapStage, and a side panel holding ExportBar and StatusLine.
  - `workspace.ts`: the `Workspace` type (`Record<IslandId, IslandData>`) and `seedWorkspace()`. Put the pure edits beside it in `state.ts`.
  - `Header.tsx`: the island tabs, the map tabs with visible counts, and the preview background toggle. **Move the toggle into the SettingsPanel.**
  - `MapStage.tsx`: the large map plus 5 thumbnails, with font loading and re-measuring.
  - `ExportBar.tsx` and `exportActions.ts`: the `EXPORTS` table. Each run gets `{ island, layer, data, geometry }` and returns the status text.
  - `StatusLine.tsx`: `useStatus()`, 3.2 s.
  - `prefs.ts`: `PREVIEW_BACKGROUNDS`, plus `loadPreviewBackground` and `savePreviewBackground` guarded against throwing storage, and `usePreviewBackground()`.
  - `editor.css`: the §2 tokens as `:root` variables. Its classes are `.btn-primary`, `.btn-outline`, `.btn-quiet`, `.segmented`, `.tabs`, `.chip`, `.panel`, `.panel-section`, `.panel-title`, `.caption` and `.status`.
- **The render page:** `render.html` + `src/render/main.tsx`, called as `?island=&layer=`, with `window.__MAP_INPUT` overrides and `__MAP_READY` / `__MAP_ERROR`.
- **Tests:**
  - 293 vitest unit tests in `tests/unit/`. `stubMeasurer.ts` is the shared stub measurer, and `prefs.test.ts` has a Map-backed `Storage`; move it to a shared helper when `autosave` needs one too.
  - 19 Playwright checks in `tests/render/`:
    - `golden.spec.ts`: the 6 goldens;
    - `export.spec.ts`: PNG fidelity on the 6 maps, the renamed-families embedding check, PNG and JPG size and corners, the two SVGs, Copy SVG, and Download JSON = seed bytes;
    - `bundle.spec.ts`: no `react-dom/server` in the editor's first load.
  - The gates are `npm run typecheck`, `npm test`, `npm run test:render` (build, then Playwright on port 8798) and `npm run gen`.
- **Conventions:**
  - Imports inside `src/shared`, `scripts` and `tests` use `.js` suffixes; `src/map`, `src/editor`, `src/export` and `src/render` import without extensions.
  - A file-top `/* why */` comment, JSDoc on exports, functional state updates. No ESLint or Prettier.
  - zod 4: object defaults need `.prefault({})`.
  - Windows with PowerShell (Bash also available) and Node 25. `.gitattributes` forces LF.

## Pitfalls already found

- **Installed fonts hide a missing embedding.** The owner's machine has all four label faces and Montserrat installed, so an SVG in an `<img>` can look right without its `<style>`. Keep the renamed-families check in `export.spec.ts`.
- **`font-family` is unquoted in the SVG,** because React escapes quotes. A family word that starts with a digit voids the whole declaration.
- **Chromium on Windows writes clipboard text with CRLF line ends** (Blink converts the newlines, even in headless runs). Compare clipboard reads after turning CRLF into LF.
- **Playwright's ESM loader refuses JSON imports.** Specs may import `ids.ts`, `tokens.ts` and `filename.ts`. A type-only import from `schema.ts` is erased, which is fine; a value import is not. Read island names from `data/geometry/*.geo.json` with `fs`.
- **Playwright sanitises `_` to `-`** in snapshot names.
- **Port 8798:** `reuseExistingServer` is false, so a `vite preview` left running makes `npm run test:render` fail with "already used". Ask the owner to stop it; don't reuse it and don't change the port.
- **Fonts before measuring:** labels are measured with canvas `measureText`. Call `loadMapFonts` with the real labels before measuring; it uppercases them itself, since `document.fonts.load` fetches only the subsets the sample text touches. That matters when a new label font is chosen in settings.
- **React never self-closes** in static markup (`<rect …></rect>`), and **the renderer does no maths**: every number is rounded in `layout.ts`.
- **Vitest inlines `?url` and node_modules JSON imports,** so modules that use them run in Node tests.
- **Playwright contexts start with empty `localStorage`.** Once autosave exists, `export.spec`'s "Download JSON = seed bytes" still holds in a fresh context. Keep it that way: never seed a draft in a shared fixture.

## Build

### 1. `src/editor/state.ts` (TDD)
Pure updates on `Workspace`. Each returns a new workspace and never produces data that `IslandDataSchema` would refuse.
- **Hostels:**
  - edit the label;
  - toggle `visible`;
  - set coordinates. Editing a verified hostel's coordinates clears `coordsVerified` (decision 13);
  - mark verified, which is what a click on the unverified badge does;
  - set `side`, which resets `dx`/`dy` (spec §2);
  - remove, which also removes that hostel's routes (decision 3);
  - add, which takes only a canonical hostel of that island that isn't on the map yet, from `data/hostels.json` through the schema's list, at its seed position. Never a free-form name.
- **Attractions:** the same row edits, plus the icon. Add places the point at the artboard centre, unprojected (spec §2), with a new unique id.
- **Decor:**
  - toggle, icon, `size` (20–140), and a `showOn` cycle (Both maps → Hostels → Things to do);
  - add at the centre; remove.
- **Routes:**
  - add, which needs at least 2 visible hostels, otherwise a message;
  - From and To each cycle over the visible hostels and never equal each other;
  - `bend` (−1…1), `showOn`, remove.
- **Settings:** a patch validated by `SettingsSchema`.
- **Reset island** restores the seed. **Import** replaces the island with `parseDataFile`'s data.
- **Labels:** decide how an invalid label behaves (empty, over 40, outside `LABEL_CHARSET`, Nest Pass on Ibiza). The coordinates pattern is a good model: keep the raw text in row state, give the input a red border, and leave the data unchanged. Record the choice in `docs/decisions.md`.

### 2. `src/editor/autosave.ts` (TDD)
- `createDraftStore(storage)`: a debounced save and a load validated by zod. Wrap every storage access in try/catch.
- The draft stores a hash of each island's seed. If a newer committed seed arrives, a persistent warning offers "Load published" or "Keep draft" (decision 9).

### 3. The side panel (`src/editor/`)
- **Rows,** per spec §2 "Interactions":
  - `HostelRows`, `AttractionRows` with an `IconPicker` dropdown, and `DecorRows` + `RouteRows` under a new **Decor** tab (`Decor · n`);
  - `CoordsInput`: its raw text lives in local row state, and its border turns `#D15653` when the text doesn't parse;
  - the unverified and "in the sea" badges on hostel rows.
- **"⌖ Click map to place" is M5.** M4 only has "+ Add row" or "+ Add hostel".
- **`SettingsPanel`:**
  - the 9 settings from spec §2, with the ranges in `tokens.ts`;
  - the preview background, moved from the header.
  - Settings belong to the island file and are shared by its two maps.
- **Import JSON** (a file input, errors in the status line) and **Reset island** (confirm first, decision 12).
- **Status copy** as in the prototype, for example "Added — rename it in the list" and "`<Island>` back to defaults".

## Tests to write

**Unit:**
- **`state`,** for every update above: the refusals (a route needs 2 hostels, From ≠ To, only canonical hostels), removing a hostel drops its routes, coordinates clear the verified flag, and every result passes `IslandDataSchema`.
- **`autosave`** with the Map-backed `Storage`: an invalid draft falls back to the seeds, a seed-hash mismatch raises the warning, and storage that throws is survived.

**Playwright** (`tests/render/editor.spec.ts`):
- rename, and the new label reaches the SVG in capitals;
- a bad coordinate turns the border red;
- toggle;
- a settings change reaches the SVG;
- reload keeps the edits;
- an import/export round-trip;
- reset.

Keep every existing check green.

## Definition of done

1. `npm run typecheck`, `npm test` and `npm run test:render` all pass, and `npm run gen` reports everything up to date.
2. **In the running app** (the built preview), on one island:
   - edit a row of each kind, change settings, reload, and see the edits survive;
   - Download JSON, Reset, then Import the file back, and see the edits return;
   - look at the result in Chrome.
3. `docs/decisions.md` records every new departure, and `docs/plan-v1.md` marks M4 done.

## Then stop

- **Report to the owner, concisely:** what was built, test counts, what you saw in the app, and any decision you had to take.
- **Write the next brief** as `docs/prompts/m5-interaction.md`, in the same standalone style: drag, click-to-place and thumbnail selection, per the plan. Set this file's status to `done, <date>`.
- **Git:**
  - Commit only when the owner asks. When asked, commit logically: small self-contained commits, sentence-style subjects, bulleted bodies ending with the Co-Authored-By trailer.
  - Never push.
- **Owner's standing rules:**
  - SOLID and DRY, with one source of truth per fact.
  - Never invent hostel names.
  - "© OpenStreetMap contributors" stays on every map and every export.
  - No Nest Pass content on Ibiza.
  - Orange `#EA580C` is never map ink.
