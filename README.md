# Nest Island Maps

Internal mini-app for Nests Hostels. It draws the brand's island maps (Tenerife, Gran Canaria and Ibiza) from data: hostel pins, "things to do" spots, decor icons and dotted routes. Staff can edit them and export SVG, PNG, JPG or JSON.

Built from a design handoff — **read `design_handoff_island_maps/README.md` first.** It has the exact geometry, colours, type and label metrics, plus the data model, the editor behaviour and the export pipeline. The `design/` prototype is a reference, not the app. The `data/` files are production data.

## Stack

- Vite + React + TypeScript, a static site with no backend
- Browser-side export: SVG serialisation, then a canvas with embedded fonts for PNG/JPG
- Self-hosted fonts via @fontsource: Roboto Condensed, Poppins, Montserrat, Archivo Black
- Data: `data/geometry/*.geo.json` (committed, generated once) and `data/seed/*.json` (edited through the app and committed)

## Ground rules

- **One renderer:** `<IslandMap>` is the only way a map is drawn. Preview and every export use it.
- **Real coordinates:** pins come from lat/lng through the island's projection, never from hand-placed pixels. Labels move; pins don't.
- **Hostel identity:** hostel slugs match `nest-branded-flyers-generator/seed/hostels.json`. Never invent hostel names.
- **Attribution:** "© OpenStreetMap contributors" stays on every published map (ODbL).
- **Colours:** orange `#EA580C` is the website's Book Now colour and never map ink.
- **Access:** public for now, as an MVP demo at https://nestpass.ai/nestmaps/ (the owner's choice, 2026-11-24), and never indexed. It goes behind the staff login once that exists.

## Develop

```sh
npm install
npx playwright install chromium   # for npm run test:render
npm run dev                       # the editor, http://localhost:5173
```

Publishing an island is: edit it in the app, **Download JSON**, put the file in `data/seed/`, commit, then build and upload (**[docs/deploy.md](docs/deploy.md)**).

Everything runs on Windows or Linux, except that the render goldens are Windows screenshots (`tests/render/goldens/*-win32.png`), so `npm run test:render` expects Windows.

### Checks

| Command | What it proves |
|---|---|
| `npm run typecheck` | the app, the scripts and the tests compile |
| `npm test` | the shared logic (projection, clustering, labels, layout, coordinates, schema, the Ibiza firewall), SVG snapshots of every map and variant, the editor's edits and autosave, the export files, the geometry pipeline's parts plus Tenerife rebuilt against its committed file, and that generated files are current |
| `npm run test:render` | builds, then in Chromium: golden screenshots of all six maps; every map's PNG export matches Chromium's own rendering of its SVG (under 0.5 % of pixels differ); PNG 2160 transparent and JPG on white; the web SVG draws with its embedded fonts; the editor's edits, settings, reload, import and export, reset and drafts; drags, placing and thumbnails; `react-dom/server` stays out of the editor's first load |
| `npm run gen` | rewrites the derived files (`schema/*.schema.json` and the seeds in canonical form) and reports "up to date" when nothing changed |
| `npm run sync:hostels` | refreshes `data/hostels.json` from the flyers repo's `seed/hostels.json`; `-- --check` only compares |
| `npm run geometry` | rebuilds every island's coast and halo rings from the raw OSM coastlines into `test-results/geometry/`, with an overlay SVG to look at. `-- --check` holds every path within 1.5 px of `data/geometry/` and the rest of each file byte-equal. `-- --write <island>…` replaces only the named islands' files in `data/geometry/`: for an island being added, then run `npm run gen` and the render checks |

### Where things live

| Path | What |
|---|---|
| `src/map/IslandMap.tsx` | **the** renderer: a pure function of geometry, data and settings, used by the preview and every export |
| `src/map/` | also the canvas text measurer, the font loading and the fonts the web SVG embeds |
| `src/shared/` | DOM-free logic: tokens, projection, the zod schema (the source of truth), labels, layout, clustering, the coordinates parser, the island registry |
| `src/editor/` | the editor: header, stage and thumbnails, the rows, settings, export bar, autosave, drag and placing |
| `src/export/` | the SVG files, the PNG/JPG rasteriser, Download JSON |
| `render.html`, `src/render/` | the bare map page the Playwright goldens screenshot |
| `public/.htaccess` | the Apache rules the build ships: never indexed, pages re-checked and hashed assets kept a year, http to https |
| `scripts/gen-shared.ts`, `scripts/sync-hostels.ts` | the derived files, and the hostel list from the flyers repo |
| `scripts/build-geometry.ts`, `scripts/geometry/` | the geometry pipeline: fill, blur, marching squares, distance transform, Douglas–Peucker, and the Hausdorff check |
| `data/geometry/` | coast, rings and projection per island: generated once, committed, the source of truth |
| `data/seed/` | the published island data, byte for byte what Download JSON gives |
| `data/hostels.json`, `data/icons.json` | the real hostels (never invented) and the icon set |
| `schema/` | JSON Schemas for the WordPress theme, generated by `npm run gen` |
| `tests/unit/`, `tests/render/` | vitest (SVG snapshots in `__snapshots__/`) and Playwright (golden PNGs in `goldens/`) |
| `docs/` | the v1 plan, the decisions log (where the app departs from the handoff, and why), the deploy steps (`deploy.md`), and each milestone's brief in `prompts/` |
| `design_handoff_island_maps/` | the handoff: the spec README, the prototype, the reference PNGs, the original geometry tool and the raw coastlines |
