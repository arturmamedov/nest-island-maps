# M6: the geometry pipeline

> **Status:** open. Written 2026-09-28, after M5.

You are continuing **Nest Island Maps** in `A:\serverpath\laragon\nest-island-maps`, on branch `feat/v1`. It's an internal static site (Vite + React + TypeScript) that draws the Nests Hostels island maps (Tenerife, Gran Canaria, Ibiza) from data and exports them as SVG, PNG, JPG and JSON.

Milestones 1–5 are done:
- 1: scaffold, data, schema;
- 2: layout, renderer, render page, goldens;
- 3: every export, font embedding, the shell;
- 4: editing every row kind, settings, autosave, Import JSON, Reset island;
- 5: direct manipulation (drags, placing, thumbnails).

**Your job is milestone 6, the last of v1: port the geometry pipeline to pure TypeScript.**
- `scripts/build-geometry.ts` plus pure modules in `scripts/geometry/` rebuild `data/geometry/*.geo.json` (the coastline and the four halo rings of each island) from the raw OpenStreetMap coastlines.
- `npm run geometry -- --check` proves the port reproduces the committed files closely enough.

Then close v1 with the plan's own definition of done.

**The committed geometry stays the source of truth.** The script only matters when an island is added. The spec says so (handoff README §5: "The committed geo files are the source of truth"), and so does CLAUDE.md ("generated once… then committed. Don't edit it by hand"). Don't overwrite `data/geometry/` unless the owner asks, and never as a side effect of a check.

**Stop when M6 and the v1 wrap-up are done.** Nothing from "Out of v1" in the plan.

## Read first, in this order

1. `CLAUDE.md` for the non-negotiables and how to work, then `README.md`.
2. `docs/plan-v1.md`, the approved plan. Binding here:
   - decision 10: pure TS, no `@napi-rs/canvas`, deterministic on every OS;
   - the M6 section;
   - the final "Verification" section.
3. `docs/decisions.md`: all of it. It has no "Geometry" section yet; add one for every departure you make.
4. `design_handoff_island_maps/README.md` §5 "Geometry pipeline" and §1 "Geometry" / "Projection".
5. `design_handoff_island_maps/tools/build-island.js`, the reference implementation (67 lines, browser canvas). Port its behaviour, not its canvas calls. Where it and the plan disagree, the plan wins; decision 10 overrides the file's own line 5 hint to use `@napi-rs/canvas`.

## What already exists

- **The input:** `design_handoff_island_maps/tools/raw-osm-coastlines.json`. It stays the single copy; don't copy it.
  - 185 KB on one line.
  - An object keyed `ibiza`, `tenerife`, `gran_canaria`. Each value is **one closed ring** of **`[lng, lat]`** pairs, first point equal to last. There are no multipolygons, islets or holes.
  - Points: Ibiza 2172, Tenerife 3599, Gran Canaria 1886 (each count includes the closing duplicate).
  - Each ring runs counter-clockwise in lng/lat (clockwise on screen), and none self-intersects, so nonzero and even-odd fills agree.
- **The committed output:** `data/geometry/<island>.geo.json`, byte-identical to the handoff's copies.
  - Each file is exactly `JSON.stringify(obj)`: one line, no indentation, **no trailing newline**. That is unlike the seeds, which are 2-space JSON with a newline.
  - Key order: `island` (the coast path), `name`, `artboard` `[1080,1080]`, `source` (`"OpenStreetMap contributors (ODbL), via Nominatim"`), `projection` `{type:"mercator", s, lamC, mC, cx, cy, note}`, `rings` `[{id:"ring-1"…"ring-4", offsetPx: 22|62|102|160, d}]`.
  - Every path matches `^M\d+\.\d \d+\.\d(L\d+\.\d \d+\.\d)+Z$`: one subpath, exactly one decimal (`828.0` keeps its zero), no negatives, no repeated closing vertex.
  - Paths run clockwise on screen and start near the topmost row.
  - Sizes: the coast has 377–452 vertices, the rings 150–303.
  - `build-island.js` itself saved a different shape (`{proj, island, rings:[string]}`); the wrapping into the committed shape was done by hand. The port must write the committed shape.
  - `GeometrySchema` in `src/shared/schema.ts` validates it.
  - `name` also matters to `scripts/sync-hostels.ts`, which maps the flyers repo's island names to ids through it.
- **`src/shared/geo.ts`:**
  - `fitProjection(coast, box)` mirrors `build-island.js` lines 9–14 operation for operation. `tests/unit/geo.test.ts` already proves it reproduces all three committed projections **bit for bit**, which is the plan's "fitted constants exactly equal" test.
  - Also `project`/`unproject`, `parsePolygons` (M/L/Z only), `pointInPolygons` (even-odd), the memoised `pathPolygons`, and `isOnLand`.
- **The fit boxes** live only in `tests/unit/geo.test.ts` (lines 14–18) today:
  - Tenerife `[200,253,843,825]`
  - Gran Canaria `[295,289,771,812]`
  - Ibiza `[230,240,850,840]`

  Move them to `scripts/geometry/config.ts`, with the blur and ring constants, and have the test import them: one source of truth.
- **`package.json`** already has `"geometry": "tsx scripts/build-geometry.ts"`. The file doesn't exist yet, and neither does `scripts/geometry/`.
- **Script patterns to copy:**
  - `scripts/gen-shared.ts`: an exported pure function plus a main guard, `import.meta.url === pathToFileURL(process.argv[1] ?? '').href`, so tests can import it; `ROOT = join(import.meta.dirname, '..')`.
  - `scripts/sync-hostels.ts`: `--check` via `process.argv.includes('--check')` and `process.exit(1)` with a message.
- **The reference PNGs** in `design_handoff_island_maps/reference/`: `original-tenerife.png` and `original-gran_canaria.png`, both 1080 × 1080. **There is no Ibiza reference**; Ibiza never had a map.
- **Tests:** 420 vitest unit tests in `tests/unit/` and 46 Playwright checks in `tests/render/`. The gates are `npm run typecheck`, `npm test`, `npm run test:render` (build, then Playwright on port 8798) and `npm run gen`.
- **Conventions:**
  - Imports inside `src/shared`, `scripts` and `tests` use `.js` suffixes.
  - A file-top `/* why */` comment, JSDoc on exports. No ESLint or Prettier. TDD for `scripts/geometry/` (plan).
  - Windows with PowerShell (Bash also available) and Node 25; `.gitattributes` forces LF.

## The reference pipeline, step by step (`build-island.js`)

The design tool injected its inputs as parameters (lines 2–4): `KEY`, `BOX`, `BLUR`, `POINTS` (points to test for land or sea), and `BG` (an overlay image). The globals `createCanvas`, `readFile` and `saveFile` belong to the design tool and are defined nowhere.

1. **Grid** (line 8): `W=1080, PAD=300, K=1.25`, `G = round((W + 2·PAD)·K) = 2100`. The grid covers artboard −300…1380 at 1.25 cells per artboard pixel. `g2a = v/K − PAD`, `a2g = (v + PAD)·K` (line 18).
2. **Projection** (9–17): Mercator of `[lng, lat]`, bbox, `s = min(boxW/dx, boxH/dy)`, centred on the box. This is `fitProjection`, already exact. The projection constants are written unrounded.
3. **Rasterise and blur** (42):
   - the projected ring is filled (nonzero) on a G × G canvas, with `ctx.filter = 'blur(BLUR px)'`;
   - BLUR is 2.2 (Tenerife, Gran Canaria) or 4.2 (Ibiza). CSS `blur()` is a Gaussian standard deviation in **canvas pixels**, which here are grid cells (1.76 or 3.36 artboard px).
4. **Field** (43): the canvas alpha, 0–255 integers.
5. **Coast** (44): `dp(contour(F, 127.5), 0.35)`, the 50 % contour. Douglas–Peucker tolerance 0.35 **artboard** px, since `contour` returns artboard coordinates.
6. **Island mask and distance** (52–53): `inside = F > 127`, then `d1 = edt(inside)`, the distance of every cell to the island.
7. **Rings** (54–56), for k = 1…4 with `offsets [22, 62, 102, 160]` and `closings [8, 26, 48, 75]`:
   - dilate: `D = d1 ≤ (offset + closing)·K ? 0 : 1`;
   - `d2 = edt(D)`: the distance to the outside of the dilated shape;
   - trace `contour(d2, closing·K)`, then `dp(…, 0.4)`.

   Together that is a morphological closing, which gives the blobby look.
8. **Path** (26): `'M' + pts.map(p => x.toFixed(1) + ' ' + y.toFixed(1)).join('L') + 'Z'`.
9. **Overlay** (62–66): white 1080², the background image at alpha 0.5, the island stroked `#e0245e` and the rings `#1a56db` at 1.5 px, plus the test points.

**`contour`, marching squares** (28–41):
- rows outer, columns inner;
- corners `a` top-left (bit 8), `b` top-right (4), `c` bottom-right (2), `d` bottom-left (1); a corner counts as inside when `value − level ≥ 0`;
- linear interpolation `t = v0/(v0 − v1)`;
- the case table is at line 34; the saddles 5 and 10 are fixed, with no centre test;
- **samples sit at integer indices**, not at cell centres;
- segments are stitched by endpoint keys rounded to 1/1000, walking forward only;
- **only the longest line is kept**, so islets and holes are dropped.

**`edt`** (45–51): the exact squared Euclidean distance transform of Felzenszwalb and Huttenlocher (lower envelope of parabolas). It runs over the columns, then the rows, then takes square roots. `INF = 1e20`.

**`dp`** (19–25):
- `dpOpen` is iterative. It measures distance to the **infinite line** through the ends, the first maximum wins, and a point is kept only if its distance is `> tol`.
- A closed ring is split at the point farthest from `pts[0]`, simplified in two halves, and joined without the duplicate closing point.

## Pitfalls already found

- **The half-cell offset.** A canvas cell i covers [i, i+1] and is centred on i + 0.5, but `contour` places sample i at i. Every committed path is therefore shifted by about **−0.5/K = −0.4 artboard px** in x and y. Measured from the projected raw coast's centroid to the committed island's:
  - Tenerife (−0.398, −0.395)
  - Gran Canaria (−0.447, −0.373)
  - Ibiza (−0.385, −0.491)

  Rasterise with cell centres at i + 0.5 and keep the index-as-coordinate convention, or the port starts about 0.57 px off.
- **The blur can't be reproduced exactly.** `ctx.filter` is the browser's own (engines approximate large Gaussians), and the field was 8-bit alpha. Build your own normalised, truncated Gaussian kernel (the plan's test: it sums to 1), with σ in **grid cells**, and choose and record a supersampling factor for the scanline fill. The thresholds become 0.5 and `> 127/255` on a 0–1 field.
- **Exact equality at the thresholds.** EDT values are square roots of integers. `(offset + closing)·K` squared is an integer for ring 2 (110² = 12100), and `closing·K` squared is an integer for rings 1 and 3 (10², 60²). So `≤`, `≥`, the 1/1000 key rounding and the insertion order all matter at those rings.
- **The DOM types typecheck in scripts.** `tsconfig.app.json` includes `scripts` with the DOM lib, so `Path2D`, `ImageData` or `document` compile and then fail under Node. Use none of them.
- **Playwright wipes `test-results/`** at the start of every run (there is no `outputDir`). `npm run test:render` therefore deletes `test-results/geometry/`; rebuild it after a render run if you need it.
- **`npx tsx -e` with modules that import the seeds hung here.** Use vitest or a script file. `geo.ts` imports nothing, so it is safe.
- **The Hausdorff baseline**, measured before the port, between the raw projected coast and the committed island path:
  - committed → raw: 1.30 px (Tenerife), 1.38 (Gran Canaria), 2.45 (Ibiza);
  - raw → committed: 12.2, 12.9, 15.0, because the blur removes thin features.

  The distance between the port and the committed files must be symmetric (the maximum of both directions), and it should sit well below these numbers. Which vertices DP keeps at 0.35–0.4 px adds some error on its own.
- **The seeds carry a copy of the projection** (`tests/unit/seeds.test.ts` requires it equal to the geometry's). The port must not change the constants; if it ever did, `npm run gen` would have to rewrite the seeds.
- **Port 8798:** `reuseExistingServer` is false, so a `vite preview` left running on it makes `npm run test:render` fail. For a manual look, serve on another port (M4 and M5 used 8810) and stop it afterwards.

## Build

### 1. Pure modules (TDD) in `scripts/geometry/`
The plan's list is `{config, fit, raster, blur, contour, edt, simplify, path}.ts`.
- **`fit`:** reuse `src/shared/geo.ts`'s `fitProjection` rather than writing a second one (DRY). Record the departure from the plan's list.
- **`config`:** the boxes, the blur per island, `PAD`, `K`, the offsets, the closings, the two DP tolerances and the thresholds. `geo.test.ts` imports its boxes from here.
- **`raster`:** a supersampled scanline fill of one polygon onto the G × G grid, cell centres at i + 0.5, giving a 0–1 coverage field.
- **`blur`:** a separable Gaussian with a normalised kernel.
- **`contour`:** marching squares as above: the longest line, artboard coordinates.
- **`edt`:** Felzenszwalb–Huttenlocher.
- **`simplify`:** `dpOpen`/`dp` as above.
- **`path`:** `toD`, one decimal.

Everything is deterministic, with no randomness and no dependence on the platform's floats beyond IEEE doubles.

### 2. `scripts/build-geometry.ts`
- **Default run:** builds all three islands into `test-results/geometry/`: the `.geo.json` in the committed shape, byte for byte, plus an overlay SVG per island. The overlay puts the new coast (red) and rings (blue) over the reference PNG, and over the committed paths for Ibiza.
- **`--write`:** overwrites `data/geometry/`. Only when the owner asks.
- **`--check`:**
  - fails (exit 1) unless every island's coast and four rings are within the Hausdorff tolerance of the committed paths, and the projection constants are exactly equal;
  - prints each distance.
  - **Measure first, then set the tolerance.** The plan expects under 1.5 px. If Ibiza can't get there (its blur is larger), record why and the number you chose.
- Validate the output with `GeometrySchema`.

## Tests to write

**Unit, in `tests/unit/` (the plan's list):**
- EDT on synthetic shapes: a single point, a square, the distance to an L-shape corner, against brute force.
- Marching squares on synthetic fields: a disc traced at the right radius, the saddle cases, only the longest line kept, the index-as-coordinate convention.
- Douglas–Peucker: collinear points dropped, the tolerance is strict, and a closed ring keeps its split point.
- The blur kernel sums to 1 and is symmetric.
- The scanline fill: coverage of a unit square, and cell centres.
- `toD` formatting.
- The fitted constants are exactly equal (already in `geo.test.ts`; switch it to the shared boxes).
- A fast Hausdorff check of one island against the committed file, if it runs in a few seconds; otherwise leave it to `--check`.

## Definition of done

1. `npm run typecheck`, `npm test` and `npm run test:render` all pass; `npm run gen` reports everything up to date; `npm run geometry -- --check` passes.
2. The overlays for Tenerife and Gran Canaria have been looked at over their reference PNGs, and Ibiza's over its committed paths.
3. **The v1 wrap-up** (plan, "Verification"):
   - a manual pass in real Chrome of the editor preview for all 3 islands × 2 maps;
   - drag, place, import and export;
   - the exported PNG, JPG and web SVG opened in Chrome and compared with the reference PNGs;
   - `README.md` gains a "Checks" table and a "Where things live" table, as in the flyers repo.
4. `docs/decisions.md` has a "Geometry" section with every departure (at least: the reused `fitProjection`, the blur, the supersampling factor, the thresholds, the chosen tolerance). `docs/plan-v1.md` marks M6 and v1 done.

## Then stop

- **Report to the owner, concisely:**
  - what was built;
  - the measured Hausdorff distances and the tolerance chosen;
  - test counts;
  - what you saw in the overlays and in the app;
  - any decision you had to take.
- **Set this file's status** to `done, <date>`. There is no next milestone brief; v1 is complete.
- **Git:**
  - Commit only when the owner asks. When asked, commit logically: small self-contained commits, sentence-style subjects, bulleted bodies ending with the Co-Authored-By trailer.
  - Never push.
- **Owner's standing rules:**
  - SOLID and DRY, with one source of truth per fact.
  - Never invent hostel names.
  - "© OpenStreetMap contributors" stays on every map and every export.
  - No Nest Pass content on Ibiza.
  - Orange `#EA580C` is never map ink.
