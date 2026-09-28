# Handoff: Nest Island Maps

## Overview

A small internal web app for the Nests Hostels team. It draws the brand's illustrated island maps (Tenerife, Gran Canaria, Ibiza) **from data** instead of from Photoshop files, and lets staff:

- add, remove, rename and re-place **hostels** (pins go where their lat/lng says)
- make **"things to do" maps** on the same island base (attractions with icons)
- place **decor icons** (mountain, forest, sun, boat…) and **dotted routes** between hostels
- change fonts, sizes, label style, pin style, colours and ring count
- export **SVG** (Figma / Illustrator / website), **PNG** (transparent), **JPG** (white), and the **data JSON**

It replaces `tenerife.png` / `gran_canaria.png` used in the Nest Pass module of nestshostels.com, and adds the Ibiza map that never existed.

**Target repo:** `arturmamedov/nest-island-maps` (empty — start from `REPO_README_STARTER.md` and `CLAUDE_STARTER.md` in this folder).

**Sister project:** `arturmamedov/nest-branded-flyers-generator`. Deliberately a separate repo (different product, different design rules, no backend here). Reuse its conventions: Vite + React + TypeScript, inline styles in the renderer, one renderer for preview and export, `modern-screenshot` for client export, hostel **slugs** from its `seed/hostels.json`, SOLID/DRY, feature branches, never push unasked.

## About the design files

The files in `design/` are **design references built in HTML** — a working prototype of the intended look and behaviour, not production code to copy. `Island Maps.dc.html` opens directly in Chrome (it needs `support.js` next to it and an internet connection for Google Fonts). Recreate it as a proper React + TS app. The **data files in `data/` are production-ready** and should be copied into the repo as-is.

## Fidelity

**High-fidelity.** Map artwork (colours, ring shapes, pin geometry, shadow, label metrics) is final and was matched to the owner's Photoshop settings (`reference/photoshop-*.png`). The editor panel is mid-fi: keep its behaviour and copy, restyle freely within the Nests design system.

---

## 1. The map (the renderer)

One component, e.g. `<IslandMap island layer settings data />`, renders an SVG with `viewBox="0 0 1080 1080"`. **It is the only renderer** — editor preview, SVG export and PNG/JPG export all use it.

### Layer order (bottom → top) and SVG ids

Use these `id`s — they become layer names in Figma/Illustrator.

| # | id | Content |
|---|---|---|
| 1 | `halo-rings` → `ring-4`, `ring-3`, `ring-2`, `ring-1` | 4 filled paths (outermost first) |
| 2 | `island` | coastline path |
| 3 | `decor` → `route-*`, `decor-*` | dotted routes, then decor icons |
| 4 | `hostels` (or `attractions`) | leader lines → markers `pin-*` / `spot-*` → labels `label-*` |
| 5 | `attribution` | "© OpenStreetMap contributors" |

### Geometry

From `data/geometry/<island>.geo.json` (path data already in artboard pixels).

- **Rings** — fill `url(#halo)`, a horizontal `linearGradient` (objectBoundingBox, x1 0 → x2 1). Stacked fill-opacity: ring-4 **0.20**, ring-3 **0.30**, ring-2 **0.50**, ring-1 **1.0**. That gives composite alpha 0.20 / 0.44 / 0.72 / 1.0, which matches the original PNG. The rings are **transparent**, so the map works on any background.
- **Island** — fill `url(#land)` (linearGradient x1 1, y1 0 → x2 0, y2 1). Stroke `#FFFFFF` **9px**, `stroke-linejoin: round`.
- **Setting `rings: n` (0–4)** shows only the innermost `n` rings.

### Palettes

| Token | Original (default) | Brand teal |
|---|---|---|
| land gradient | `#7FCECF` → `#98D6C8` | `#53CED1` → `#309EAA` |
| halo gradient | `#35434E` → `#475B70` | `#083344` → `#0D6F82` |
| ink (text, dots, attraction badge, decor on land) | `#394755` | `#083344` |
| accent (hostel pill) | `#FEB700` | `#FFDE59` |

"Original" colours were sampled from the existing brand PNGs. Brand teal uses only design-system tokens (primary `#53CED1`, third `#309EAA`, secondary `#0D6F82`, cyan-950 `#083344`, nest-yellow `#FFDE59`). Orange `#EA580C` is never used on the maps.

### Projection

Spherical Mercator, fitted per island (the constants are in each geo file):

```
x = cx + (lng·π/180 − lamC) · s
y = cy − (ln(tan(π/4 + lat·π/360)) − mC) · s
inverse: lng = ((x − cx)/s + lamC)·180/π ;  lat = (2·atan(exp(mC − (y − cy)/s)) − π/2)·180/π
```

### Hostel pin

- **Path** (tip at 0,0; head centre 0,−30; radius 16; hole radius 7; `fill-rule: evenodd`), fill `#FFFFFF`:
  `M0 0C-4.5-9-16-17.5-16-30A16 16 0 1 1 16-30C16-17.5 4.5-9 0 0ZM7-30A7 7 0 1 0-7-30A7 7 0 1 0 7-30Z`
- **Transform:** `translate(x y) scale(pinSize)`. Default pinSize **0.9** (range 0.6–1.4).
- **The hole is transparent,** so it shows whatever is underneath (teal on land, dark on the rings), like the original.
- **Dot style (alternative):** a white circle r 11 with an ink circle r 5 on top, centred on the point.
- **Shadow** = Photoshop "Ombra esterna": black, opacity 25%, angle 120°, distance 0, spread 5%, size 9px. As an SVG filter (also applied to label pills):
  ```xml
  <filter x="-40%" y="-60%" width="180%" height="220%">
    <feMorphology operator="dilate" radius="0.5" in="SourceAlpha" result="spread"/>
    <feGaussianBlur in="spread" stdDeviation="4.5" result="blur"/>
    <feFlood flood-color="#000" flood-opacity="0.25"/>
    <feComposite in2="blur" operator="in" result="shadow"/>
    <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  ```
- **Clustering:** hostels whose projected points are **< 14px** apart share one pin, placed at their mean. The El Médano cluster has three hostels and one pin, with labels stacked by `dx`/`dy`.
- **Draw order:** markers are drawn sorted by y, so lower pins sit on top.

### Labels (hostels and attractions)

- **Font:** **Roboto Condensed Bold (700), 25px, letter-spacing 0.19em** (Photoshop tracking 190 = 4.75px), UPPERCASE in the data string itself. Don't use CSS text-transform: the exported SVG must carry capitals.
- **Other font options:** Poppins 600, Montserrat 700, Archivo Black 400. Self-host them all (`@fontsource/*`, pinned).
- **Pill:** height `fs·1.42`, horizontal padding `fs·0.55`, radius `h·0.5` (fully round). For the non-condensed fonts use `fs·1.7`, `fs·0.75` and `h·0.3`.
- **Width:** `measureText(text) + letterSpacing·chars + 2·padX`. Measure with the real font once it has loaded, and re-measure after `document.fonts.ready`.
- **Text position:** `text-anchor: middle`, x = `letterSpacing/2` (compensates the trailing tracking), y = `fs·0.36` (baseline for vertically centred caps). Don't use `dominant-baseline`: Figma ignores it.
- **Styles** (setting `labelStyle`):

  | Style | Hostels | Attractions |
  |---|---|---|
  | Accent pill (default) | accent pill, ink text | white pill, ink text |
  | White pill | white pill, ink text | white pill, ink text |
  | Dark pill | ink pill, white text | ink pill, white text |
  | Text only | ink text with a white `paint-order: stroke` halo (`fs·0.32` wide), no shadow | same |

- **Placement:** `side` (below / above / right / left), plus a free `dx`/`dy` nudge in artboard px, set by dragging. Anchor offsets from the point, with gap 8:
  - **Hostel pin:**
    - below: `(0, 8 + h/2)`
    - above: `(0, −(46·ps + 8 + h/2))`
    - right / left: `(±(16·ps + 8 + w/2), −30·ps)`
  - **Attraction badge (r 22):** ±(22 + 8 + h/2 or w/2), vertically centred for left / right.
  - **Dot style:** same as the badge, but with r 11.
- **Clamping:** after the nudge, clamp the label centre so the pill stays inside x 12…1068 and y 12…1040.
- **Leader line:** drawn when `hypot(dx, dy) > 6`, from the marker's head centre to the label centre, underneath both. White, 2.5px, round caps.

### Attraction marker

- **Badge:** circle r **22**, fill ink, stroke `#FFFFFF` 3px.
- **Icon:** a Lucide icon (`data/icons.json`) at `translate(−13 −13) scale(1.0833)`, i.e. 26px, stroke `#FFFFFF` 1.9, no fill, round caps and joins.
- **Colour by category (next step, not built):** badge colour per attraction type (beach, hike, food…), using design-system semantic colours plus a legend. Keep `icon` and add `category`.

### Decor icons

- **Rendering:** a Lucide icon of `size` px (20–140), centred on its lat/lng, as `translate(x − size/2, y − size/2) scale(size/24)`. The stroke width is `2.6 / (size/24)`, so strokes stay 2.6px on screen. No fill, round caps.
- **Auto colour:** ink on land. On the sea it turns `#FFFFFF` when it sits in a ring zone whose composite alpha is ≥ 0.44, i.e. ring-1…ring-3, counting only rings that are showing. Otherwise it stays ink.
- **`showOn`:** `both` | `hostels` | `attractions`. The big on-island pieces default to `hostels` so they don't collide with attraction badges; sea pieces default to `both`.
- **The original line illustrations** (volcano, lighthouse, beach scene, landscape) are raster-only in the PNGs. If the vector originals turn up, add them to the icon set. Keep the same `{ paths[] }` shape, or add a `{ svg }` variant.

### Dotted routes

- **Endpoints:** hostel slug → hostel slug, from pin tip to pin tip. Hidden hostels hide their routes.
- **Path:** quadratic `M a Q c b`. The control point is `mid + n · bend · len/2`, where `n = (−dy, dx)/len` and `bend` ranges −1…1.
- **Style:** stroke `#FFFFFF` 2.5, `stroke-dasharray: 7 7`, round caps, opacity 0.85. `showOn` defaults to `hostels`.

### Attribution

`© OpenStreetMap contributors` at x 1062, y 1064, `text-anchor: end`, Montserrat 14px, ink at 55% opacity. **It must stay on every published map** (ODbL). Staff may move it, but not delete it.

---

## 2. The editor (app shell)

Reference: turn 2 of `design/Island Maps.dc.html`. A good structure:

- **Header:** island switcher (Tenerife · Gran Canaria · Ibiza) and layer switcher (Hostels · Things to do · Decor).
- **Canvas:** the map at a comfortable size, with a 3px `#53CED1` outline (offset 3) on the map being edited. The prototype shows all six maps. The app can show one large map with thumbnails of the others.
- **Side panel (≈460px):** the data list for the current layer, add / place buttons, exports, and a status line.
- **Settings panel:** the prototype's Tweaks, below.

### Interactions

- **Hostels / Things to do rows:**
  - visibility toggle: 18px circle with a 2px `#53CED1` border, filled when visible
  - name input
  - **"Lat, lng" input:** accepts a Google Maps paste such as `28.04700, -16.53550`, and also `;` or a space as the separator. The border turns `#D15653` when it doesn't parse.
  - label side: 4 buttons ↓ ↑ → ←; choosing one resets `dx`/`dy`
  - attractions only: an icon button (preview, name, ↻) that cycles through the icon set; a dropdown picker is better in the real app
  - × to remove
- **Adding points:**
  - **"+ Add row"** adds a point at the artboard centre (unprojected).
  - **"⌖ Click map to place"** arms placing. The cursor becomes a crosshair and a dark pill banner appears on the map ("Click the island to drop a new hostel · Esc to cancel"). The next click on that map adds a point there; Esc cancels.
- **Dragging:**
  - **Labels:** pointer-down on a label, then drag; this updates `dx`/`dy`, scaled by `1080 / renderedWidth`. It saves on pointer-up. A drag must not also count as a map click.
  - **Decor:** dragging an icon moves its lat/lng, and switches the panel to that island's Decor tab.
- **Decor tab:**
  - icon rows: toggle, icon cycle, size slider (20–140), "Show on" cycle (Both maps → Hostels → Things to do), ×
  - "+ Add icon" and "⌖ Click map to place"
  - "Dotted routes" rows: toggle, From → To (click to cycle through the island's hostels), bend slider (−1…1), Show on, ×
  - "+ Add route" needs at least 2 visible hostels, otherwise it shows a message
- **Clicking a map that isn't selected** selects that island and layer (or only the island while on the Decor tab).
- **Status line:** short confirmations such as "SVG downloaded" or "Added — rename it in the list", which clear after 3.2 s.
- **Reset island** restores that island's seed data.

### Settings (the prototype's Tweaks)

| Setting | Options | Default |
|---|---|---|
| palette | Original · Brand teal | Original |
| background (preview only, never exported) | White · Focus surface (`linear-gradient(to top left, #53CED1, #0D6F82 50%, #083344)`) | White |
| labelFont | Roboto Condensed · Poppins · Montserrat · Archivo Black | Roboto Condensed |
| labelSize | 14–36 px | 25 |
| labelTracking | 0–0.30 em | 0.19 |
| labelStyle | Accent pill · White pill · Dark pill · Text only | Accent pill |
| pinStyle | Pin · Dot | Pin |
| pinSize | 0.6–1.4 | 0.9 |
| rings | 0–4 | 4 |
| showIcons (decor + routes) | on/off | on |

Store the settings per map in the data file, so a saved map reproduces exactly.

### UI tokens (editor chrome)

- **Fonts:** Montserrat for the UI, Poppins 700 for panel titles.
- **Text colours:** `#0f172a` main, `#475569` secondary, `#64748b` / `#94a3b8` muted.
- **Borders and backgrounds:** input borders `#e2e8f0` with focus `#53CED1`; row dividers `#f1f5f9`.
- **Buttons:**
  - primary: `#0D6F82` background, white text, hover `#083344`, radius 8px, 10px padding, 600 12.5px
  - outline: 2px `#53CED1` border, `#0D6F82` text
  - quiet: `#f1f5f9` background
  - hover on every control: `scale(1.03–1.1)` over 300 ms (design-system rule)
- **Active tab:** `#0D6F82` background, white text.
- **Error:** `#D15653`.

---

## 3. Data model

`data/seed/<island>.json`, one file per island:

```jsonc
{
  "island": "tenerife", "name": "Tenerife",
  "hostels":     [{ "slug": "medano-nest", "label": "Médano", "lat": 28.0455, "lng": -16.5385,
                    "coordsVerified": false, "labelPlacement": { "side": "right", "dx": 16, "dy": 0 }, "visible": true }],
  "attractions": [{ "id": "teide", "label": "Teide", "lat": 28.2724, "lng": -16.6425, "icon": "mountain",
                    "labelPlacement": { "side": "above", "dx": 0, "dy": 0 }, "visible": true }],
  "decor":       [{ "id": "sun", "icon": "sun", "lat": 28.56, "lng": -16.86, "size": 44, "showOn": "both", "visible": true }],
  "routes":      [{ "id": "puerto-arena", "from": "puerto-nest", "to": "arena-nest", "bend": 0.25, "showOn": "hostels", "visible": true }]
}
```

- **Hostel slugs** match `nest-branded-flyers-generator/seed/hostels.json` (all 14). **Never invent hostel names.** `label` is the short map label ("El Duque" for `duque-nest`).
- **`coordsVerified: false` on every hostel.** All coordinates are approximations from each hostel's town/street. The owner must replace them with each property's real map pin (the pin, not the `@` viewport in a Maps URL) and flip the flag. Show an unverified badge in the editor until then.
- **Validation:** define a zod schema as the source of truth and generate a JSON Schema from it, as the flyers repo does.
- **Storage (v1):** localStorage autosave, plus "Download data (JSON)" / "Import JSON". Committing edited JSON back to the repo is the publishing path. There's no backend. If one is ever needed, copy the flyers repo's storage seam instead of inventing a new one.
- **Export JSON** also includes `artboard: [1080,1080]` and the island's `projection`, so the WordPress theme can place pins with the same formula.

---

## 4. Export

| Format | How | Notes |
|---|---|---|
| SVG | Serialise the rendered `<svg>`: set `xmlns`, width/height 1080; strip editor-only things (cursor styles, `user-select`, transparent hit rects `[data-hit]`, any selection outlines) | Filters (shadow) survive in browsers and Illustrator. Figma may drop them on import; that's acceptable, but note it in the UI. |
| PNG | Rasterise the **same** SVG at **2160 × 2160**, transparent | Fonts **must be embedded**. The prototype fetches Google Fonts CSS, inlines the woff2 files as data URLs in a `<style>` inside the SVG, then draws the SVG to a canvas. In the app, embed the self-hosted `@fontsource` files instead, which works offline. `modern-screenshot` (already used in the flyers repo) is also fine; keep a fidelity check either way. |
| JPG | Same as PNG on a `#FFFFFF` fill, quality 0.92 | |
| JSON | `{ island, artboard, projection, hostels, attractions, decor, routes, settings }` | |

- **Filenames:** `<island>-<hostels|attractions>.<ext>` and `<island>-map-data.json`.
- **Export is browser-only,** so the app is a static site. It can live at e.g. `nestpass.ai/maps/` on the same IONOS host as the flyers app.
- **Access:** the prototype has no login. Treat it like the flyers app, internal only, until the shared login exists.

---

## 5. Geometry pipeline (how `data/geometry` was made)

`tools/build-island.js` is the reference implementation (browser canvas); `tools/raw-osm-coastlines.json` holds the source polygons.

1. **Coastlines** come from OpenStreetMap via Nominatim polygon lookups:
   - Tenerife R2108882
   - Gran Canaria R2214683
   - Ibiza R6076060
2. **Projection:** Mercator, uniformly fitted into a box. The boxes were chosen so the new vector overlays the original PNGs (Ibiza had none):
   - Tenerife `[200,253,843,825]`
   - Gran Canaria `[295,289,771,812]`
   - Ibiza `[230,240,850,840]`
3. **Coast smoothing:** rasterise at 1.25× with a blur (2.2px; Ibiza 4.2px because it's shown larger), trace the 50% contour with marching squares, then Douglas–Peucker at 0.35px.
4. **Rings:**
   - Take a Euclidean distance transform of the island mask.
   - Dilate by `offset + close`, then erode by `close` (a morphological closing, which gives the blobby look). Offsets are `[22, 62, 102, 160]`, closings `[8, 26, 48, 75]`.
   - Trace each ring, then Douglas–Peucker at 0.4px.
5. **Output:** the paths have 1-decimal precision.

Port it to `scripts/build-geometry.ts` with `@napi-rs/canvas`, or swap the raster steps for a polygon offset library. **The committed geo files are the source of truth;** the script only matters when adding an island.

---

## 6. Build plan (suggested steps)

1. **Scaffold** Vite + React + TS (mirror the flyers repo's tsconfig, lint and test setup). Self-host the fonts. Copy `data/` into the repo.
2. **`<IslandMap>` renderer:** a pure function of (geometry, data, settings), matching §1. Add a render test that snapshots each island's SVG, plus a Playwright pixel check against a golden PNG.
3. **Editor shell:** island and layer switchers, lists, inputs, click-to-place, drag labels and decor, settings panel, localStorage autosave, import/export JSON.
4. **Exports:** SVG, PNG and JPG with embedded fonts, plus a fidelity check (PNG vs a Chromium screenshot of the SVG within 0.5%).
5. **Hostel coordinates:** replace all 14 with verified pins (owner task) and flip `coordsVerified`.
6. **Later (don't start unasked):**
   - attraction categories with colours and a legend
   - a WordPress embed: the theme renders the same SVG from this JSON, so a new hostel in WP puts a pin on the island
   - a Leaflet "what's around" section per hostel page (OSM tiles, brand pin, 5/10/15-min walking rings echoing the halos)
   - swapping in the original vector illustrations

## Assets and licences

- **Coastlines:** © OpenStreetMap contributors (ODbL). The on-map credit is required.
- **Icons:** Lucide (ISC), path data inlined in `data/icons.json`. These stand in for the original Photoshop line illustrations.
- **Fonts:** Roboto Condensed (OFL), Poppins (OFL), Montserrat (OFL), Archivo Black (OFL).
- **Reference images:**
  - `reference/original-*.png`: the current website maps
  - `reference/photoshop-*.png`: the owner's label and shadow settings

## Files in this bundle

| Path | What |
|---|---|
| `design/Island Maps.dc.html` + `support.js` | The working prototype. Turn 2 is the definitive set; turn 1 is the first Tenerife exploration plus the brainstorm |
| `data/geometry/*.geo.json` | Island + ring paths, projection constants (production) |
| `data/seed/*.json` | Hostels, attractions, decor and routes per island (production, coords unverified) |
| `data/icons.json` | Icon set (Lucide paths) |
| `tools/build-island.js`, `tools/raw-osm-coastlines.json` | Geometry pipeline + source coastlines |
| `reference/` | Original PNG maps and Photoshop settings screenshots |
| `REPO_README_STARTER.md`, `CLAUDE_STARTER.md` | Starting README and CLAUDE.md for the new repo |
