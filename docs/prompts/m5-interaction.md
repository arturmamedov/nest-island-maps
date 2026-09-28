# M5: direct manipulation on the map

> **Status:** open. Written 2026-09-28, after M4.

You are continuing **Nest Island Maps** in `A:\serverpath\laragon\nest-island-maps`, on branch `feat/v1`. It's an internal static site (Vite + React + TypeScript) that draws the Nests Hostels island maps (Tenerife, Gran Canaria, Ibiza) from data and exports them as SVG, PNG, JPG and JSON.

Milestones 1 (scaffold, data, schema), 2 (layout, renderer, render page, goldens), 3 (every export, font embedding, the shell) and 4 (editing every row kind, settings, autosave, Import JSON, Reset island) are done. **Your job is milestone 5, direct manipulation on the map:**
- dragging a label moves its `dx`/`dy`;
- dragging a decor icon moves its lat/lng and switches to that island's Decor tab;
- "⌖ Click map to place" arms placing: a crosshair, a banner, and the next click adds a point there; Esc cancels;
- clicking a thumbnail selects that map.

**Stop when M5 is done.** Don't start the geometry pipeline (M6), and nothing from "Out of v1" in the plan.

## Read first, in this order

1. `CLAUDE.md` for the non-negotiables and how to work, then `README.md`.
2. `docs/plan-v1.md`, the approved plan. Its decisions are binding, above all:
   - 3, never invent hostels;
   - 6, edit mode is the `interaction` prop only;
   - 13, the coordinates input.
   The M5 section lists the work and the tests.
3. `docs/decisions.md`: all of it, especially "Map", "Editor shell", "Editing" and "Autosave". Add every new departure to it.
4. `design_handoff_island_maps/README.md` §2 "Interactions": "Adding points", "Dragging", and "Clicking a map that isn't selected".
5. The prototype, as reference only: `design_handoff_island_maps/design/Island Maps.dc.html`, turn 2. Search it for `onLabelDown`, `onDecorDown`, `onMove`, `onUp`, `mapClick` and `placing`. Where it disagrees with the spec or the plan, they win. It has no drag threshold, for one: the plan's 3 px threshold wins.

## A question for the owner before you build placing on the Hostels tab

The prototype's "⌖ Click map to place" works on all three tabs, and on Hostels it adds a free "New Nest". That is gone for good (decision 3: hostels come only from `data/hostels.json`). The README's ground rules also say "pins come from lat/lng through the island's projection, never from hand-placed pixels. Labels move; pins don't."

So placing makes clear sense for Things to do and Decor, but not obviously for Hostels. Ask the owner before building it. The options:
- **No placing on the Hostels tab** (recommended): hostels come back at their seed position and move only through their coordinates.
- Placing a hostel picked from "+ Add hostel" at the click, unverified.

Record the answer in `docs/decisions.md`.

## What already exists

- **`src/shared/`** (DOM-free):
  - `tokens.ts`: every number and colour, including `ARTBOARD` (1080), `LABEL_BOX` (the label clamp box) and `DECOR_SIZE`.
  - `ids.ts`: `ISLAND_IDS`, `LAYERS`, `LAYER_LABELS`, `TABS`, `TAB_LABELS`, `SHOW_ON` and `SHOW_ON_LABELS`. It imports no JSON, so Playwright can import it.
  - `schema.ts`: the zod source of truth (`IslandDataSchema` with its refinements), plus `LabelSchema`, `parseLabel(text, island)`, `CANONICAL_HOSTELS` and `canonicalHostels(island)`.
  - `geo.ts`: `project`, `unproject`, `pathPolygons` (memoised) and `isOnLand` (the "in the sea" badge).
  - `coords.ts`: `parseCoords`, `formatCoords`, `onArtboard` and `OFF_MAP`.
  - `datafile.ts` (`serializeDataFile`, `parseDataFile`, `issueText`), `islands.ts` (`ISLANDS`, `ISLAND_LIST`), `labels.ts`, `layout.ts`, `cluster.ts`, `icons.ts`, `filename.ts`.
- **`src/map/IslandMap.tsx`**, the only renderer. Its `interaction?: MapInteraction` prop already exists:
  - `onLabelPointerDown(e, { layer, key })` and `onDecorPointerDown(e, key)`;
  - with it, the map adds transparent `data-hit` rects and cursor styles, and nothing else. A unit test holds the rest of the markup identical to the export.
  - Nothing passes `interaction` yet. The stage (`MapStage.tsx`) draws all six maps without it.
- **`src/editor/`:**
  - `state.ts`: the pure edits. Each is an `IslandEdit`, `(data, island) => EditResult`, and `tryEdit` holds every result to `IslandDataSchema` (a refusal changes nothing). `applyEdit(ws, island, edit)` returns the new workspace.
    - Useful here: `setCoords` (refuses off-artboard points), `setSide`, `addAttraction()`, `addDecor()`, `NEW_SPOT` and `NEW_DECOR`.
    - The add edits place a point at the artboard centre through a private `centre(island)`. Placing needs the same edits at a given point: give them an optional point rather than writing new ones.
    - Label drag needs a new edit that sets `dx`/`dy` (whole pixels) without touching the side. Decor drag needs one that sets a decor icon's lat/lng (5 decimals, on the artboard).
  - `autosave.ts`: `createDraftStore(storage)`, debounced (400 ms), flushed on `pagehide`. A drag that updates state on every move is fine for the draft; the save skips unchanged text.
  - `App.tsx`: the state `{ workspace, bases, revisions, problems, island, tab, layer }`. `edit(e, done?)` applies an edit and shows its refusal, its note or `done`. `selectTab` keeps `tab` and `layer` in step (the Decor tab keeps the last map on the stage).
  - `MapStage.tsx`:
    - the large map (`data-testid="selected-map"`) and five thumbnails;
    - `selected` outlines on the HTML wrapper, including both of the island's maps on the Decor tab;
    - the font loading, keyed on each island's label face and labels.
  - The rows: `HostelRows` (with the "+ Add hostel" menu), `AttractionRows`, `DecorRows`, `RouteRows`, `PointRow`, `RowControls`, `CoordsInput`, `IconPicker`.
    - Every row is a `role="group"` named after its label and carries `data-key` (the slug or id).
    - The lists sit in one wrapper keyed `${tab}:${island}:${revision}`, so they start over on reset and import.
  - `usePopover.ts`: the shared popover behind the icon picker and "+ Add hostel" (closes on a choice, a click or focus elsewhere, or Esc). Reuse it rather than writing another.
  - `useRawText.ts`: the label and coordinates inputs keep raw text in row state. It resyncs when the value changes from outside, so a drag that moves a point updates its "Lat, lng" text by itself.
  - `SettingsPanel`, `IslandActions` (Import JSON, Reset island with an inline confirm), `DraftNotice` (stale and unreadable drafts), `ExportBar`, `StatusLine` (`useStatus()`, 3.2 s), `prefs.ts`, `browserStorage.ts` (`STORAGE_KEYS`, `browserStorage()`).
  - `editor.css`: the §2 tokens as `:root` variables, plus the row, settings and notice classes.
- **The side panel intro** is the prototype's, minus two sentences that M5 makes true: "drag a label to move it" and "Click any map to edit it here". Put them back. The prototype's text: "Paste coordinates straight from Google Maps (right-click a place → copy the numbers). Pins land in the right spot automatically; drag a label to move it. Click any map to edit it here."
- **Tests:**
  - 386 vitest unit tests in `tests/unit/`:
    - `stubMeasurer.ts` is the shared stub measurer;
    - `storage.ts` holds the Map-backed and the throwing `Storage`;
    - `state.test.ts` has `ok()` and `chain()` helpers that hold every result to the schema.
  - 36 Playwright checks in `tests/render/`:
    - `golden.spec.ts`: the 6 goldens;
    - `export.spec.ts`: fidelity and the export files;
    - `bundle.spec.ts`: no `react-dom/server` in the first load;
    - `editor.spec.ts`: the M4 editing checks.
    - `helpers.ts` has `download`, `selectMap`, `seedText`, `islandName` and `ROOT`.
  - The gates are `npm run typecheck`, `npm test`, `npm run test:render` (build, then Playwright on port 8798) and `npm run gen`.
- **Conventions:**
  - Imports inside `src/shared`, `scripts` and `tests` use `.js` suffixes; `src/map`, `src/editor`, `src/export` and `src/render` import without extensions.
  - A file-top `/* why */` comment, JSDoc on exports, functional state updates. No ESLint or Prettier.
  - zod 4: object defaults need `.prefault({})`, and `z.record(enum, …)` demands every key.
  - Windows with PowerShell (Bash also available) and Node 25. `.gitattributes` forces LF.

## Pitfalls already found

- **Duplicate sibling keys.** M4 once keyed several panel sections by the island id alone. React then kept stale lists mounted, and all four tabs' rows showed at once. Keys must be unique among siblings; the row lists sit in one wrapper keyed `${tab}:${island}`.
- **Never use a `<select>` as an action menu.** On Windows a focused select changes its value on the arrow keys without opening, so each keypress would run the action. M4 swapped "+ Add hostel"'s select for a `usePopover` menu for that reason.
- **Hover scale and reduced motion:** `editor.css` has one hover rule reading `--hover-scale`. A control sets the variable, never its own `transform`, or it escapes the reduced-motion override.
- **All six maps share their layer ids** (`label-*`, `pin-*`, `decor-*`), by design (they are Figma layer names). In Playwright, scope to the large map (`getByTestId('selected-map')`) or check a downloaded SVG.
- **Playwright's viewport is 1080 wide,** under the 1100 px breakpoint, so the specs see the stacked layout: the panel below the stage, and the page scrolling. Drag tests must compute pointer positions from the map's bounding box, never from constants.
- **Playwright contexts start with empty `localStorage`.** Never seed a draft in a shared fixture. `editor.spec` seeds one through `addInitScript` guarded by a `sessionStorage` flag, so a reload reads what the app saved.
- **Installed fonts hide a missing embedding.** Keep the renamed-families check in `export.spec.ts`.
- **`font-family` is unquoted in the SVG,** because React escapes quotes.
- **Chromium on Windows writes clipboard text with CRLF.**
- **Playwright's ESM loader refuses JSON imports.** Specs may import `ids.ts`, `tokens.ts`, `filename.ts` and `src/editor/browserStorage.ts`, which are JSON-free.
- **Port 8798:** `reuseExistingServer` is false, so a `vite preview` left running on it makes `npm run test:render` fail. For a manual look, serve on another port (M4 used 8810) and stop it afterwards.
- **The Playwright MCP browser** may only write under the repo; `.playwright-mcp/` is gitignored.
- **`npx tsx -e` with modules that import the seeds hung here.** Use vitest or a script file.
- **CSS order in `editor.css`:** `.caption` sets its margin late in the file, so a modifier needs the doubled class (`.caption.rows-caption`).
- **Fonts before measuring:** labels are measured with canvas `measureText`. `loadMapFonts` runs whenever an island's label face or label text changes.
- **The renderer does no maths,** and React never self-closes. Round drag results in the edits (whole pixels for `dx`/`dy`, 5 decimals for lat/lng), not in the renderer.

## Build

### 1. The drag maths (TDD, DOM-free)
- A small pure module for:
  - the 3 px threshold, so a press that moves less than 3 px is a click, never a drag;
  - the screen-to-artboard scale, `1080 / renderedWidth`;
  - the new `dx`/`dy` from the start values and the pointer delta, in whole pixels;
  - the new decor point: project the start, add the scaled delta, unproject, 5 decimals, clamped or refused off the artboard.
- The new edits in `state.ts`, held to the schema like the rest: a label nudge, and a decor move.

### 2. `useDrag`
- Pointer capture on pointer-down on a label or decor icon, through `IslandMap`'s `interaction` prop, on the large map only.
- It moves only after the threshold, and saves through the normal edit path. A drag must never also count as a map click (the prototype's `_suppress`).
- Label drag sets `dx`/`dy`, clamped as the layout clamps (`LABEL_BOX`).
- Decor drag moves lat/lng and switches the panel to that island's Decor tab (spec §2).

### 3. `usePlacing`
- "⌖ Click map to place" beside "+ Add row" and "+ Add icon": the prototype's button, which reads "Cancel placing" while armed.
- Armed: a crosshair on the map and a dark pill banner on the HTML wrapper, never in the SVG. The prototype's copy:
  - Things to do: "Click the island to drop a new spot · Esc to cancel";
  - Decor: "Click the map to drop a decor icon · Esc to cancel";
  - Hostels: see the owner question above.
- The next click on the selected map adds the point there, with the M4 statuses ("Added — rename it in the list", "Icon added — …"). Esc cancels, and so does changing the tab or island.

### 4. Thumbnail selection
- Clicking a map that isn't selected selects that island and layer, or only the island while on the Decor tab (spec §2).
- The thumbnails need a button role and a name for keyboard users.

## Tests to write

**Unit:** the drag maths (threshold, scale, rounding, decor unproject round-trip, clamping) and the new edits, each result passing `IslandDataSchema`.

**Playwright** (`tests/render/interaction.spec.ts`):
- dragging a label changes its position in the SVG, and a reload keeps it;
- a press that moves under 3 px is not a drag;
- dragging decor moves it and switches to the Decor tab;
- placing adds a spot where clicked (check its lat/lng in Download JSON against `unproject` of the click), and Esc cancels;
- clicking a thumbnail selects that map.

Keep every existing check green.

## Definition of done

1. `npm run typecheck`, `npm test` and `npm run test:render` all pass, and `npm run gen` reports everything up to date.
2. **In the running app** (the built preview): drag a label and a decor icon, place a spot and an icon, select maps by their thumbnails, reload, then look at the result and an exported PNG in Chrome.
3. `docs/decisions.md` records every new departure and the owner's answer on hostel placing; `docs/plan-v1.md` marks M5 done.

## Then stop

- **Report to the owner, concisely:** what was built, test counts, what you saw in the app, and any decision you had to take.
- **Write the next brief** as `docs/prompts/m6-geometry.md`, in the same standalone style: the geometry pipeline, per the plan's M6 section. Set this file's status to `done, <date>`.
- **Git:**
  - Commit only when the owner asks. When asked, commit logically: small self-contained commits, sentence-style subjects, bulleted bodies ending with the Co-Authored-By trailer.
  - Never push.
- **Owner's standing rules:**
  - SOLID and DRY, with one source of truth per fact.
  - Never invent hostel names.
  - "© OpenStreetMap contributors" stays on every map and every export.
  - No Nest Pass content on Ibiza.
  - Orange `#EA580C` is never map ink.
