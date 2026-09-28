# Nest Island Maps — v1 implementation plan

> **Status:** approved by the owner on 2026-09-27. M1 done on 2026-09-27 (branch `feat/v1`, commits `c10c8f2`…`3539c25`). M2 done on 2026-09-28 (commits `ec13684`…`8f8e48e`). M3 is next.

## Context

Nests Hostels' island maps are Photoshop PNGs today: Tenerife, Gran Canaria, and Ibiza (new). We're building a small internal **static web app** that draws them **from data** and exports SVG / PNG / JPG / JSON. It's a sister to `nest-branded-flyers-generator`: a separate repo that follows the same conventions.

When the plan was written, the repo held only `README.md`, `CLAUDE.md` and the handoff (since moved to `design_handoff_island_maps/`):
- its `README.md` is **the spec**, with exact geometry, colours, label metrics, data model, editor behaviour and exports;
- its `data/` folder is production data.

**Scope, agreed:** the full v1, which is spec §6 steps 1–4:
- scaffold
- `<IslandMap>` renderer
- full editor
- exports with fidelity checks

It also includes porting the geometry pipeline to `scripts/build-geometry.ts` now.

## Decisions

**Made with the user**
- Labels stay **mixed-case in the data** and are uppercased in JS (`toUpperCase()`) when rendering, never with CSS. The exported SVG carries capitals. The CLAUDE.md line "Text is stored uppercase" gets corrected to say this.
- There is **one `settings` object per island file**, shared by that island's two maps. It is saved and exported.

**Settled by the spec or house rules.** Each one is also recorded in `docs/decisions.md`.
1. **Seed file = the Download JSON file,** byte for byte: `JSON.stringify(parse(x), null, 2) + '\n'`, LF.
   - A one-time normalisation adds `settings`, plus `artboard` and `projection`, which are copied from the geo file.
   - A test keeps `seed.projection` equal to `geo.projection`. The app always reads the projection from geometry.
   - Import rejects a file whose artboard or projection doesn't match that island.
2. **The spec wins over prototype quirks:**
   - tracking `fs·0.19` is 4.75, not 4.8;
   - pill h `fs·1.42` is not rounded (numbers are rounded only when written into the SVG);
   - routes run between cluster pin tips;
   - clustering is deterministic single-linkage, hostels only and visible only;
   - fonts load at their real weights.
3. **Never invent hostels.**
   - `data/hostels.json` is `{slug, name, island}`, derived from the flyers `seed/hostels.json` by `scripts/sync-hostels.ts`.
   - "+ Add hostel" offers only canonical hostels on that island that aren't already on the map, and restores their seed position.
   - Slugs are never editable. Removing a hostel also removes its routes.
4. **Ibiza firewall:** a named regex `/nest\s*pass/i` is enforced through a zod `superRefine` on Ibiza data. Tests assert that no Ibiza SVG matches it.
5. **Decor auto-colour:**
   - Take the true composite alpha of the rings that are shown and cover the point: `1 − Π(1 − op)`. Land counts as ink.
   - The icon is white if the alpha is `≥ 0.44 − 1e-9`, otherwise ink.
   - Point-in-polygon runs on the M/L/Z paths without the DOM.
6. **SVG export = `renderToStaticMarkup(<IslandMap>)`,** a pure string function that is testable in Node, with no DOM clone-and-strip.
   - Edit mode is simply the presence of an `interaction?` prop. It adds only `data-hit` rects and cursor styles.
   - The selection outline, crosshair and placing banner live on the HTML wrapper.
   - A test asserts that edit markup minus `data-hit` and cursor equals export markup.
7. **Exports:**
   - SVG for Figma / Illustrator (no fonts).
   - **SVG for web** with fonts embedded, because an `<img src=svg>` can't use the page's fonts.
   - PNG 2160, transparent. JPG white, quality 0.92.
   - JSON.
   - Fonts are embedded from `@fontsource` woff2 files (`?url` → fetch → base64, with `unicode-range` taken from each package's `unicode.json`). `modern-screenshot` isn't needed.
8. **Defs ids** are prefixed `${island}-${layer}-{halo,land,shadow}`, including in exports, so two inline maps on one page don't clash. Layer ids stay bare (`halo-rings`, `ring-1..4`, `island`, `decor`, `hostels`/`attractions`, `attribution`, `pin-*`, `spot-*`, `label-*`, `route-*`, `decor-*`) because they become Figma layer names.
9. **Stale drafts:**
   - The localStorage draft stores a hash of each island's seed.
   - If a newer committed seed arrives (for example, verified coordinates), a persistent warning offers "Load published" or "Keep draft".
10. **Geometry pipeline in pure TS** (the spec allows this), with no `@napi-rs/canvas`:
    - supersampled scanline fill;
    - our own Gaussian blur, marching squares, EDT and Douglas–Peucker.
    It is deterministic, identical on every OS, and unit-testable.
11. **Golden PNGs:** Playwright `toHaveScreenshot`, with win32 goldens committed and `maxDiffPixelRatio 0.005`. The export fidelity check (pixelmatch) compares two live buffers and commits nothing.
12. **Attribution** stays at a fixed position in v1 (moving it is optional in the spec). **Reset island** asks for confirmation.
13. **Coordinates input:**
    - It accepts `lat, lng`, `lat; lng` and `lat lng`.
    - It rejects Maps URLs, which carry the `@` viewport, and points that project outside the artboard (swapped lat/lng).
    - The raw text lives in local row state; the data holds numbers only.
    - Unverified and "in the sea" badges appear on hostel rows. Clicking the unverified badge marks the hostel verified. Editing a verified hostel's coordinates clears the flag again.
14. **The handoff folder moves to `design_handoff_island_maps/`** at the repo root, which is the path README and CLAUDE.md already use (flyers has `design_handoff_flyer_generator/`).

## Stack (mirrors flyers)

- npm; Node ≥22 (`.nvmrc` 24); `"type": "module"`.
- Runtime: react / react-dom ^19.3, zod ^4.6.5, `@fontsource/{roboto-condensed,poppins,montserrat,archivo-black}` pinned at 5.3.0.
- Build and types: vite ^8.3, @vitejs/plugin-react ^6.1, typescript ^7.0.2, tsx.
- Tests: vitest ^4.1 (node environment, top-level `tests/`), @playwright/test 1.63.0, pixelmatch plus pngjs.
- No ESLint or Prettier (flyers has none).
- Vite: `base: './'`, MPA inputs `index.html` and `render.html`.
- `tsconfig.app.json`: `types: ["vite/client","node"]`, strict, no enums or namespaces.
- `.gitattributes`: `* text=auto eol=lf`, and binary for png, jpg and woff2. It gets committed first, because `core.autocrlf=true` on this machine.

## Repo layout

```
design_handoff_island_maps/     spec + prototype + reference (moved, unchanged)
data/geometry/*.geo.json        copied as-is (source of truth)
data/seed/*.json                normalised once (decision 1)
data/icons.json, data/hostels.json
schema/*.schema.json            generated by `npm run gen`, committed, staleness-tested
src/shared/                     DOM-free
  tokens.ts    palettes, ring opacities, pin path, font table + pill ratios, gap/clamp box, attribution, shadow
  geo.ts       project / unproject / fitProjection, parse M/L/Z, point-in-polygon
  schema.ts    zod source of truth (IslandId, LabelPlacement, Hostel, Attraction, Decor, Route,
               Settings via .prefault, IslandData = export shape, Geometry, Icons, firewall + charset refines)
  coords.ts    paste parser
  cluster.ts   single-linkage < 14px, mean position
  labels.ts    TextMeasurer type, pill metrics, side anchors (pin / dot / badge), clamp, leader rule
  layout.ts    computeMapLayout(geometry, data, layer, measure) → rounded primitives (settings from data.settings)
  ids.ts       ISLAND_IDS, LAYERS (JSON-free, so Playwright specs can import them)
  islands.ts   registry id → name, geometry, seed;  filename.ts
src/map/       IslandMap.tsx (THE renderer), measure.ts (canvas measureText), fonts.ts (fontsVersion hook), embedFonts.ts
src/export/    svg.ts, raster.ts, json.ts, download.ts
src/editor/    main.tsx, App.tsx, Header, MapStage (large map + 5 thumbnails), side panel rows
               (HostelRows, AttractionRows, DecorRows, RouteRows, CoordsInput, IconPicker), SettingsPanel,
               ExportBar (incl. "Figma may drop shadow filters" note), StatusLine (3.2 s), PlacingBanner,
               state.ts (pure updates on Workspace), autosave.ts (createDraftStore(storage), debounced,
               zod-validated, seed hash), prefs.ts (preview background), useDrag.ts, usePlacing.ts, editor.css
src/render/main.tsx + render.html   bare map page for Playwright (__MAP_READY / __MAP_ERROR)
scripts/       gen-shared.ts, sync-hostels.ts, build-geometry.ts, geometry/{config,fit,raster,blur,contour,edt,simplify,path}.ts
tests/unit/    *.test.ts(x) + __snapshots__/*.svg      tests/render/  *.spec.ts + goldens/
docs/decisions.md
```

## Milestones

Each milestone ends in something demonstrable. I stop after each one so you can look. Commits happen only when you ask.

**Git:** `git switch -c feat/v1` on the unborn `main`.

TDD applies to the `src/shared/` and `scripts/geometry/` modules.

### M1 – Scaffold, data, schema (done 2026-09-27)
- **Done as planned**, plus `src/shared/datafile.ts` (the file shape shared by seeds and the Download JSON) and `src/shared/icons.ts`. 69 unit tests.
- **Work:**
  - Move the handoff folder, copy `data/`, then run `sync:hostels` and the seed normalisation.
  - Add the configs, `index.html` with the font specimen, `src/shared/{tokens,geo,schema,coords,islands}.ts`, and `gen-shared.ts`.
  - Fix the uppercase line in CLAUDE.md.
- **Tests:**
  - Seeds parse and are canonical.
  - Slugs ⊆ `hostels.json` for the matching island.
  - Ids are unique, route endpoints exist, icons exist.
  - Firewall and charset.
  - Projection round-trip < 1e-9°, and it matches the geo constants.
  - Coords parser cases.
  - Generated schema is up to date.
- **Verify:** `npm run typecheck; npm test; npm run build`.

### M2 – Layout + renderer + render page (done 2026-09-28)
- **Done as planned**, plus `src/shared/ids.ts`, `src/export/svg.ts` (the pure string part) and a Montserrat snapshot variant. 185 new unit tests (254 in all) and 6 render goldens. The renderer decisions are in `docs/decisions.md` under "Map".
- **Work:** `cluster.ts`, `labels.ts`, `layout.ts`, `IslandMap.tsx`, `measure.ts`, `fonts.ts`, `render.html`, `playwright.config.ts`.
- **Tests:**
  - El Médano is 3 hostels → 1 pin.
  - Pill metrics and side anchors for pin, dot and badge; clamp; leader threshold.
  - Decor colour table over `rings` 0–4 using the real seed decor.
  - Route bend path.
  - **SVG file snapshots** of all 6 maps plus variants (dot, text-only, brand teal, rings 2), using a stub measurer.
  - Guards: no `#EA580C`, no Nest Pass on Ibiza.
  - Playwright golden screenshots for the 6 maps.
- **Verify:** `npm test; npm run test:render`. Compare in Chrome against `design_handoff_island_maps/reference/original-*.png`.

### M3 – Export + minimal shell
Export comes before editing because font-embedded rasterising is the riskiest piece.
- **Work:**
  - `src/export/*`, `embedFonts.ts`, `filename.ts`.
  - Shell: header with the island and layer switchers, MapStage with thumbnails, ExportBar (SVG, SVG for web, Copy SVG, PNG, JPG, Download JSON), StatusLine, prefs.
- **Tests:**
  - Unit: the export SVG has `xmlns`, 1080 size, capitals, the attribution and the layer ids, and no editor attributes; the JSON has the spec's shape.
  - **Fidelity:** the app's PNG vs a Chromium screenshot of the SVG at DPR 2 with `omitBackground` must differ by < 0.5% of pixels.
  - The PNG is 2160 with transparent corners; the JPG has white corners.
- **Verify:** `npm test; npm run test:render`, then open an exported PNG in Chrome.

### M4 – Data editing + persistence
- **Work:**
  - `state.ts` and `autosave.ts`.
  - Rows for hostels (toggle, label, coords, side ↓↑→←, badges, ×, add from canonical list), attractions (+ icon picker dropdown), decor (icon, size 20–140, Show on), and routes (From → To over visible hostels, bend −1…1, Show on; needs 2 hostels).
  - SettingsPanel (9 settings + preview background), Import JSON, Reset island.
- **Tests:**
  - `state` and `autosave` with a Map-backed Storage: invalid draft, seed-hash mismatch.
  - Playwright `editor.spec`:
    - rename
    - a bad coordinate turns the border red
    - toggle
    - a settings change reaches the SVG
    - reload keeps edits
    - import/export round-trip
    - reset
- **Verify:** `npm run typecheck; npm test; npm run test:render`.

### M5 – Direct manipulation
- **Work:**
  - `useDrag` with pointer capture and a 3 px threshold, so a drag is never a click. It scales by `1080 / renderedWidth`.
  - Label drag sets `dx`/`dy`. Decor drag unprojects to lat/lng and switches to the Decor tab.
  - `usePlacing`: "⌖ Click map to place" shows a crosshair and a banner; Esc cancels.
  - Clicking a thumbnail selects that map.
- **Tests:**
  - Drag maths unit tests.
  - Playwright `interaction.spec` covering each behaviour above.
- **Verify:** same commands as M4.

### M6 – Geometry pipeline
Independent of the other milestones; any time after M1.
- **Work:** `scripts/build-geometry.ts` plus pure modules in `scripts/geometry/`. The input is `design_handoff_island_maps/tools/raw-osm-coastlines.json`, which stays the single copy. The script writes to `test-results/geometry/`, and `--write` overwrites `data/geometry/`.
- **Tests:**
  - EDT and marching squares on synthetic shapes.
  - Douglas–Peucker.
  - The blur kernel sums to 1.
  - Fitted projection constants **exactly** equal the committed ones.
- **Check:** `npm run geometry -- --check` compares the paths with the committed ones by Hausdorff distance. I'll measure first, then set the tolerance (expected under 1.5 px). It also writes an overlay SVG over the reference PNG.

## Verification (definition of done, from CLAUDE.md)

- `npm run typecheck && npm test && npm run test:render` all pass.
- `npm run gen` reports everything up to date.
- `npm run geometry -- --check` passes.
- Manual pass in real Chrome:
  - the editor preview for all 3 islands × 2 layers;
  - drag, place, import and export;
  - the exported PNG, JPG and web SVG opened in Chrome and compared with the reference PNGs.
- README gets a "Checks" table and a "Where things live" table, as in flyers.

## Out of v1 (don't start unasked)

- Deployment and access (IONOS subfolder, internal only), and the shared `<nest-nav>` bar.
- Attraction categories and legend, the WordPress embed, the Leaflet "what's around" page, and the original vector illustrations.
- Per-layer settings, undo, a movable attribution.
- Verifying hostel coordinates is the owner's task. `puerto-nest` and `las-eras-nest` currently project into the sea, so they will show the "in the sea" badge.
