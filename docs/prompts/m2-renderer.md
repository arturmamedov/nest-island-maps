# M2: layout, renderer and render page

> **Status:** open. Written 2026-09-28, after M1.

You are continuing **Nest Island Maps** in `A:\serverpath\laragon\nest-island-maps`, on branch `feat/v1`. It's an internal static site (Vite + React + TypeScript) that draws the Nests Hostels island maps (Tenerife, Gran Canaria, Ibiza) from data and exports them as SVG, PNG, JPG and JSON.

Milestone 1 (scaffold, data, schema) is done and committed. **Your job is milestone 2:**
- the map layout maths;
- the `<IslandMap>` renderer;
- a bare render page;
- SVG snapshot tests and Playwright golden images.

**Stop when M2 is done.** Don't start the editor or the PNG export.

## Read first, in this order

1. `CLAUDE.md` for the non-negotiables and how to work, then `README.md`.
2. `docs/plan-v1.md`, the approved plan. Its decisions 1–14 and the M2 section are binding.
3. `docs/decisions.md`, which lists where the app departs from the prototype. Add every new departure to it.
4. `design_handoff_island_maps/README.md` §1, the renderer spec. Its exact numbers already live in `src/shared/tokens.ts`: import them, never retype them.
5. The prototype, as reference only: `design_handoff_island_maps/design/Island Maps.dc.html`.
   - Lines 26–67: SVG structure.
   - Lines 563–592: decor colour, decor, routes.
   - Lines 660–715: `buildLayer` (labels, clusters, markers).

   Where it disagrees with the spec, the spec wins.

## What already exists

- **`src/shared/`** (DOM-free):
  - `tokens.ts`: all numbers and colours of the artwork.
  - `geo.ts`: `project`, `unproject`, `parsePolygons`, `pointInPolygons`.
  - `schema.ts`: the zod source of truth, with types `IslandData`, `Settings`, `Geometry`, `Layer`, `Side`, `LabelStyle`, `PinStyle`, …
  - `islands.ts`: `ISLANDS[id].geometry` / `.seed`.
  - `icons.ts`: `ICONS[id].paths`.
  - `datafile.ts`, `coords.ts`.
- **Geometry files:** the key `island` holds the **coastline path**, and `rings[]` runs innermost first (ring-1 … ring-4).
- **`src/map/fonts.css`** loads the four label faces plus Montserrat 400. `src/editor/main.tsx` is a font-specimen placeholder until M3.
- **Tests:** 69 vitest unit tests in `tests/unit/` (node environment, no jsdom). Gates are `npm run typecheck`, `npm test` and `npm run build`. `npm run test:render` runs `build && playwright test` and has no tests yet.
- **Conventions:**
  - Imports inside `src/shared`, `scripts` and `tests` use `.js` suffixes; `src/map`, `src/editor` and `src/export` import without extensions.
  - A file-top `/* why */` comment, JSDoc on exports, and functional state updates.
  - No ESLint or Prettier.
  - zod 4: object defaults need `.prefault({})`.
  - Windows machine with PowerShell (Bash also available) and Node 25. `.gitattributes` forces LF.

## Build (TDD for everything in `src/shared/`)

### 1. `src/shared/cluster.ts`

- Clusters **visible hostels only**; attractions never cluster.
- Rule: **single linkage** on the projected points with distance < `CLUSTER_PX` (14), using union-find. It must be deterministic and independent of item order; the prototype's greedy pass is not.
- The pin sits at the members' mean position. Its id is `pin-<first member in data order>`.

### 2. `src/shared/labels.ts`

Holds the `TextMeasurer` type `(text, { family, weight, size }) => width`, plus pill metrics, anchors, clamp and the leader rule.

**Metrics** (spec formulas, unrounded):
- `ls = fs·tracking` (4.75 at the defaults).
- Condensed font (Roboto Condensed): `h = fs·1.42`, `padX = fs·0.55`, `r = h·0.5`. Other fonts: `fs·1.7`, `fs·0.75`, `h·0.3`.
- `w = measure(TEXT) + ls·chars + 2·padX`, where `TEXT = label.toUpperCase()` and `chars = [...TEXT].length`.
- Text position: `x = ls/2`, `y = fs·0.36`, `text-anchor: middle`. Never use `dominant-baseline`.

**Anchor offsets** from the marker point, with gap 8 and `ps` = pinSize:

| Marker | below | above | right / left |
|---|---|---|---|
| Pin | `(0, 8 + h/2)` | `(0, −(46·ps + 8 + h/2))` | `(±(16·ps + 8 + w/2), −30·ps)` |
| Attraction badge, r 22 | `(0, r + 8 + h/2)` | `(0, −(r + 8 + h/2))` | `(±(r + 8 + w/2), 0)` |
| Dot | as the badge, with `r = 11·ps` | | |

The dot row is a **decision**: the dot is drawn scaled by `pinSize` like the pin, so its label anchor scales with it. Log it in `docs/decisions.md`.

**After the anchor:**
- Add the label's `dx`/`dy`.
- Clamp the centre to `x ∈ [12 + w/2, 1068 − w/2]` and `y ∈ [12 + h/2, 1040 − h/2]`.
- Draw a leader when `hypot(dx, dy) > 6`, using the raw dx/dy. It runs from the marker's head centre (pin: `(0, −30·ps)`; dot and badge: the centre) to the clamped label centre.

**Label styles:**

| Style | Hostels | Attractions |
|---|---|---|
| accent | accent pill, ink text | white pill, ink text |
| white | white pill, ink text | white pill, ink text |
| dark | ink pill, white text | ink pill, white text |
| text | ink text with a white `paint-order: stroke` halo `fs·0.32` wide; no rect, no shadow | same |

### 3. `src/shared/layout.ts`

`computeMapLayout(geometry, data, layer, measure)` returns plain primitives, reading settings from `data.settings`.

- **Rounding:** round every number in the output, coordinates to 1 decimal and metrics to 2. React prints raw floats such as `0.30000000000000004`, and the markup must be deterministic.
- **Cache:** keep parsed polygons in a `Map` keyed by path string.

**Rings**
- Show only the innermost `settings.rings`.
- Emit outermost first: ring-4 … ring-1.
- Fill opacity is `RING_OPACITY[i]`.

**Decor**
- Include an icon when it is visible, `showIcons` is on, and `showOn` is `'both'` or equals the layer.
- Transform: `translate(x − size/2, y − size/2) scale(size/24)`, stroke width `2.6/(size/24)`.
- **Colour** (plan decision 5), tested at the icon centre:
  - on land → ink;
  - otherwise α = `1 − Π(1 − RING_OPACITY[i])` over the *shown* rings containing the point → white if `α ≥ 0.44 − 1e-9`, else ink.

**Routes**
- Include a route when it is visible, `showIcons` is on, and its `showOn` matches the layer.
- Both hostels must be visible. Endpoints are their **cluster pins**; skip the route if both ends are in the same cluster.
- Path: `M a Q c b`, where `c = mid + n·bend·len/2` and `n = (−dy, dx)/len`.

**Markers**
- Hostel pins (or dots) per cluster, or attraction badges, sorted by y ascending so lower markers sit on top.
- Labels are anchored at their cluster pin, each with its own side, dx and dy.
- Draw order: leaders, then markers, then labels.

### 4. `src/map/IslandMap.tsx`, the only renderer

- **Props:** `{ geometry, data, layer, measure?, interaction? }`.
- **Purity:** a pure function of its props. No effects, no `useId`, no DOM reads. It must render the same through `renderToStaticMarkup`.
- **Root:** `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">`.

**Defs**, with ids prefixed `${island}-${layer}-`:
- `halo`: linearGradient `x1 0 y1 0 x2 1 y2 0`, stops `halo[0]` → `halo[1]`.
- `land`: `x1 1 y1 0 x2 0 y2 1`, stops `land[0]` → `land[1]`.
- `shadow`: the spec's filter. Its region is `x -40% y -60% width 180% height 220%`, and it chains `feMorphology dilate 0.5` → `feGaussianBlur 4.5` → `feFlood #000 0.25` → `feComposite in` → `feMerge`.

**Layer ids** (they become Figma layer names), in this order:
1. `halo-rings` containing `ring-4`…`ring-1`.
2. `island`: fill the land gradient, stroke `#FFFFFF` 9, `stroke-linejoin` round.
3. `decor` containing `route-*` then `decor-*`. Omit the group when it's empty.
4. `hostels` or `attractions` containing leaders, then `pin-*` / `spot-*`, then `label-*`.
5. `attribution`: text at x 1062, y 1064, anchor end, Montserrat 14 / 400, ink at opacity 0.55. It is always present.

**Markup rules**
- Use presentation attributes, not style objects. Set the shadow with `filter="url(#…)"`, never through `style`.
- Write `font-family` unquoted (`Roboto Condensed, sans-serif`), because React escapes `'`.
- Inline every path; no `<use>` or `<symbol>`.
- Put the shadow on pin and dot groups and on pill rects. Attraction badges have no shadow, as in the prototype.

**Markers**
- Pin: `translate(x y) scale(ps)`, the `PIN_PATH` with fill white and `fill-rule` evenodd. The hole stays transparent.
- Dot: white r 11 plus ink r 5, under the same transform.
- Badge: `translate(x y)`, a circle r 22 filled ink with stroke white 3. Its icon group is `translate(−13 −13) scale(26/24)`: stroke white 1.9, no fill, round caps and joins.
- Leader: white, 2.5 wide, round caps.

**Edit mode**
- `interaction?` is the edit mode. Define the `MapInteraction` type now (label and decor pointer-down callbacks).
- In edit mode only, add transparent `data-hit` rects over labels and decor, plus `cursor` styles. Nothing else may differ from export markup.

### 5. `src/map/measure.ts` and `src/map/fonts.ts`

- `measure.ts`: a canvas `measureText` measurer using the font string `${weight} ${size}px "${family}"`. It adds no letter spacing; the layout adds `ls·chars` itself.
- `fonts.ts`:
  - `loadMapFonts(texts)` calls `document.fonts.load()` for the current label face at its real weight, with the label text as the sample, and for Montserrat 400. Then it awaits `document.fonts.ready`.
  - Add a small `useFontsVersion()` hook that bumps on `document.fonts` `loadingdone`, for the editor in M3.

### 6. `src/export/svg.ts`, the pure string part only

`renderMapSvg(props)` returns:

```
'<?xml version="1.0" encoding="UTF-8"?>\n' + renderToStaticMarkup(<IslandMap …/>).replace(/></g, '>\n<') + '\n'
```

The line breaks between tags keep diffs readable; they're safe because the markup has no mixed content. Snapshots use this function. Font embedding, raster, download and the dynamic import of `react-dom/server` come in M3.

### 7. Render page

- `render.html` plus `src/render/main.tsx`, and add `render` to `vite.config.ts` `rollupOptions.input`.
- Query `?island=&layer=`, with optional overrides from `window.__MAP_INPUT = { data?, settings? }` injected by tests through `addInitScript`.
- Page: transparent `html`/`body`, margin 0, the SVG at 1080 × 1080.
- Sequence: await `loadMapFonts`, render, wait two frames, then set `window.__MAP_READY = true`. On failure set `window.__MAP_ERROR`.

### 8. Playwright

**`playwright.config.ts`**
- `testDir: './tests/render'`, `workers: 1`, `timeout: 60_000`, reporter list.
- Viewport 1080 × 1080, `deviceScaleFactor: 1`, `baseURL` `http://127.0.0.1:8798`.
- webServer: `npx vite preview --host 127.0.0.1 --port 8798 --strictPort` with `reuseExistingServer: false`. `test:render` builds first.
- `snapshotPathTemplate: '{testDir}/goldens/{arg}-{platform}{ext}'`.
- `expect.toHaveScreenshot: { maxDiffPixelRatio: 0.005, threshold: 0.1 }`.

Chromium 1243 may already be installed under `%LOCALAPPDATA%\ms-playwright`, shared with the flyers repo. If not, run `npx playwright install chromium`.

**`tests/render/golden.spec.ts`**
- Cover all 6 maps (3 islands × 2 layers).
- For each, wait for `__MAP_READY`, then `toHaveScreenshot('<island>-<layer>.png', { omitBackground: true })` on the SVG.
- Create the goldens with `npx playwright test --update-snapshots` on the first run only, **then look at every one of them.**

## Tests to write

**Unit tests** in `tests/unit/*.test.ts(x)`. If `.tsx` tests don't transform, add `plugins: [react()]` to `vitest.config.ts`.

- **`cluster`:**
  - Tenerife's 9 hostels give 7 pins, and Ashavana, Médano and Los Amigos share one.
  - Shuffling the hostels gives the same clusters.
  - Hidden hostels are ignored.
- **`labels`:**
  - Default metrics: h 35.5, padX 13.75, r 17.75, ls 4.75.
  - Non-condensed metrics at 25 px: h 42.5, padX 18.75, r 12.75.
  - Every side for pin, dot and badge.
  - Clamping at the artboard edges.
  - Leader threshold of 6.
- **`layout`:**
  - The ring filter for 0–4 rings.
  - **Decor colour table over `rings` 0–4 using the real seed decor.** Tenerife's `boat` and `waves` sit in the ring-3 zone: white at 4 rings, ink at 3.
  - `showOn` / `showIcons` filtering.
  - The route control point, and a route inside one cluster is skipped.
  - Markers sorted by y.
- **`render.test.tsx`:**
  - `toMatchFileSnapshot` in `tests/unit/__snapshots__/` for the 6 maps, plus variants: dot, text-only, brand teal, rings 2, and Montserrat (non-condensed pill).
  - Use a pure stub measurer, `[...text].length · size · 0.55`.
- **Guards over every snapshot:**
  - No `#EA580C` (case-insensitive).
  - No `/nest\s*pass/i` in the Ibiza output.
  - All layer ids and the attribution are present.
  - Labels are uppercase in the output.
  - No `data-hit` or `cursor` in export output.
  - **Edit markup minus hit rects and cursor equals export markup.**

## Definition of done

1. `npm run typecheck`, `npm test` and `npm run test:render` all pass.
2. Open the render page in Chrome, using the Playwright MCP or the built preview, and view all 6 goldens.
3. Compare them side by side with `design_handoff_island_maps/reference/original-tenerife.png` and `original-gran_canaria.png`:
   - Expected differences: Lucide decor instead of the raster illustrations, and one pin for the El Médano cluster.
   - Everything else must match closely: ring shapes and colours, coastline stroke, pin and hole, pill, tracking, shadow.
   - Report anything else that differs.
4. `docs/decisions.md` records every new departure, and `docs/plan-v1.md` marks M2 done.

## Then stop

- **Report to the owner, concisely:** what was built, test counts, what the goldens showed next to the originals, and any decision you had to take.
- **Write the next brief** as `docs/prompts/m3-export.md`, in the same standalone style: export plus the minimal shell, per the plan. Set this file's status to `done, <date>`.
- **Git:**
  - Commit only when the owner asks. When asked, commit logically: small self-contained commits, sentence-style subjects, bulleted bodies ending with the Co-Authored-By trailer.
  - Never push.
- **Owner's standing rules:**
  - SOLID and DRY, with one source of truth per fact.
  - Never invent hostel names.
  - "© OpenStreetMap contributors" stays on every map.
  - No Nest Pass content on Ibiza.
  - Orange `#EA580C` is never map ink.
