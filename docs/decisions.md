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
- **Copy SVG copies the Figma SVG,** which pastes into Figma or code, as in the prototype, and carries no base64 fonts. On Windows, Chromium writes clipboard text with CRLF line ends, so a paste reads back with CRLF.
- **Download JSON is `serializeDataFile`,** so it is the seed's bytes, with no second serializer.
- **`react-dom/server` stays out of the editor's first load.** `src/export/svg.ts` is imported dynamically when an export runs. `tests/render/bundle.spec.ts` follows the entry script's static imports and holds this.
- **A download's object URL is revoked after 1.5 s,** as in the prototype, not during the click. Revoking it then can cancel the download.
- **Status messages** keep the prototype's wording, with these changes:
  - added "Web SVG downloaded";
  - the clipboard fallback names the real button ("use SVG (Figma) instead");
  - failures read "Export failed: <reason>". The prototype blamed the connection because it fetched Google Fonts; the fonts here are self-hosted.

## Editor shell

- **Layout:**
  - a header with the island switcher and the list tabs `Hostels · n`, `Things to do · n` and `Decor · n` (visible counts, as in the prototype);
  - the draft notices, when there are any (see "Autosave");
  - the stage, with the selected map large and the other five as thumbnails, all drawn by `IslandMap`;
  - a side panel of about 460 px, top to bottom:
    - the prototype's intro ("Data · Edit, add, remove · saved in this browser", "Map data", and its text, ending "drag a label to move it. Click any map to edit it here.");
    - the rows of the current tab;
    - Settings;
    - Export, titled with the map it exports ("Export Tenerife · Hostels"), since the Decor tab isn't a map;
    - Island data (Import JSON, Reset island);
    - the status line.
  - On a wide screen the editor is one window-high shell: the stage and the panel scroll on their own, and the status line stays in view. Below 1100 px everything stacks and the page scrolls.
  - Each thumbnail is a button that puts its map on the stage (see "Direct manipulation").
- **Decor is a tab, not a map.** On it, the stage keeps the last map shown, and both of the island's maps are outlined, as in the prototype, because decor belongs to both.
- **The preview background sits in Settings, under Colours,** marked "never exported". It moved there from the header in M4. It is a per-browser preference in `localStorage` (`nest-island-maps.previewBackground`), never in the island data or an export. It falls back to White when storage is missing or throws.
- **Settings follow the prototype's groups:** Colours, Labels, Markers, Island, with the ranges of `tokens.ts`. The font is a select; the other choices are segmented controls, built as pressed buttons in a named group (plain buttons in the tab order, like the preview chips, rather than radios without radio keys); rings is 0–4. The caption says "Both `<Island>` maps share these."
- **The selection outline and the preview background go on the HTML wrapper,** never in the SVG, so neither can reach an export.
- **The stage re-measures in two cases:** on `useFontsVersion()`, and once `loadMapFonts` has resolved for every island. A face can finish loading before the `loadingdone` listener is attached.
  - The fonts are loaded again only when an island's label face or label text changes, not on every edit, so dragging a slider doesn't reload fonts.
- **Switchers:** the island switcher is the prototype's segmented control (a white active pill). The map tabs use the spec's active tab, `#0D6F82` with white text.
- **Hover:** controls grow over 300 ms, inside the spec's 1.03–1.1: 1.04 by default, 1.1 for the small row buttons (the dot, the side arrows, ×, "⌖ Place on map"), 1.03 for the wide icon and menu buttons and the map thumbnails. One rule applies the scale each control sets, so there is no motion at all under `prefers-reduced-motion`.

## Editing

- **Every edit goes through the schema.** The edits (`src/editor/state.ts`) are pure functions from one island's data to new data or a refusal. `tryEdit` then parses the result with `IslandDataSchema` and keeps the parse output:
  - the list can never hold a file that the seeds, the draft or an import would refuse;
  - the data stays in the file's key order, so Download JSON is always seed-shaped.
  A refused edit changes nothing and its reason shows in the status line.
- **An invalid label stays in the input, red.** Empty, over 40 characters, a character the label fonts can't draw, or Nest Pass on Ibiza: the raw text stays in the row, the border turns `#D15653`, the reason shows on hover, and the map keeps the last good label. This is the coordinates pattern (decision 13). The input and the edit ask the same function, `parseLabel`, so the list accepts exactly what the file accepts. Labels are stored trimmed and NFC-normalised.
- **Ids are set once, in the seeds' style:**
  - a new spot is `new-spot`, then `new-spot-2`…;
  - a new icon is named after its icon (`sun-2`);
  - a new route after its hostels, without `-nest` (`aguere-puerto`).
  Renaming a row or cycling a route's ends never changes its id: ids are identity and, prefixed by the layout, Figma's layer names.
- **New points** sit at the artboard centre, or where the map was clicked (see "Direct manipulation"), unprojected (spec §2) and rounded to 5 decimals: about a metre, where a pixel is well over 100 m. One function, `latLngAt`, turns every artboard point into lat/lng, kept half a pixel inside the artboard so the rounding can never push it off. The defaults are the prototype's:
  - a spot is `New spot` with the star icon, label below;
  - an icon is `sun`, 40 px, on both maps;
  - a route joins the first two visible hostels, bend 0.2, on the Hostels map.
- **"+ Add hostel" offers only the island's real hostels that are not on the map** (decision 3). There is no free "+ Add row" for hostels.
  - A hostel comes back as its seed had it, in its seed place, so removing and re-adding one without routes leaves no diff. Its removed routes don't come back.
  - A canonical hostel with no seed entry (after a future `sync:hostels`) starts at the centre under its canonical name, unverified.
  - Every hostel is on its map today, so the control stays disabled ("All 9 Tenerife hostels are on the map") until one is removed.
  - It is a button that opens a short list, not a `<select>`: on Windows a focused select changes its value on the arrow keys without opening, and every change here would add a hostel.
- **Removing a hostel removes its routes,** and the status says so ("Removed, with 1 route"). Other removals are silent, as in the prototype.
- **Route ends cycle over the visible hostels,** in list order, stepping over the other end, so a route never joins a hostel to itself. The prototype cycled every hostel and allowed that. With no other visible hostel to move to, the click is refused with a message.
- **Choosing the side a label already has does nothing.** A new side clears the drag nudge (spec §2); the same side keeps it, so a stray click can't undo a hand-set stack like El Médano's.
- **The verified flag:**
  - clicking the Unverified badge marks the hostel verified at once ("`<label>` marked verified");
  - editing its coordinates clears the flag only if they actually change (decision 13).
  - "In the sea" is informational: the pin projects outside the coastline polygon.
- **Slider values are rounded before they reach the file:** label size and decor size to whole pixels; tracking, pin size and bend to 2 decimals.
- **The icon picker is a dropdown** of all 20 icons with their previews, as the spec prefers for the real app; the prototype cycled one click at a time. It and "+ Add hostel" share one popover: it closes on a choice, a click or focus elsewhere, or Esc.
- **Each row is a named group** (the label, the icon's name, or "From → To"), so a screen reader says which row a Visible, side or × button belongs to.
- **Import JSON replaces the selected island,** through `parseDataFile`. Another island's file, a projection mismatch or a schema error is refused as "Import failed: `<reason>`", and a file that isn't JSON as "Import failed: that file is not JSON". Success reads "`<Island>` imported".
- **Reset island confirms inline** (decision 12): "Reset `<Island>` to the published map? Edits to both maps are lost.", with Reset and Cancel, then "`<Island>` back to defaults". The prototype reset at once. Cancel takes the focus, and after either answer it returns to "Reset island". Settings reset too, since they belong to the island file.

## Direct manipulation

M5: dragging on the map, placing points with a click, and choosing a map by its thumbnail (spec §2 "Interactions").

- **Only the large map is edited on.** It takes the drags and, while placing, the click. The thumbnails are buttons that put their map on the stage. In the prototype all six maps were live.
- **A press becomes a drag only once it has moved 3 screen pixels** (the plan's threshold; the prototype had none). A shorter press is a click and changes nothing: no nudge, and no tab switch.
- **The pressed label or icon captures the pointer,** so the drag follows it off the map and keeps its grab or move cursor. The moves and the release are heard on the window, and one `AbortController` removes those listeners, so a lost capture or a release outside the window can't leave a drag running; a move with the button up also ends it. The prototype used window listeners without capture.
- **Screen pixels become artboard pixels** by `1080 / width of the map's <svg>`, measured at the press. The width is the `<svg>`'s own, not its frame's, which has a 1 px border.
- **Every move is an edit,** through the same path as the rows: held to the schema, shown in the list, and saved by the debounced autosave, which is flushed on `pagehide`, so a drag followed at once by a reload is kept. The spec saves on pointer-up. A move whose rounded result equals the last one sent is skipped.
- **Label drag** sets `dx`/`dy` in whole pixels and keeps the side.
  - The nudge is clamped to the range that keeps the pill inside `LABEL_BOX`, so the stored nudge is the one drawn. The prototype let it grow past the edge while the label stayed pinned there.
  - The layout gives each label that range (`LabelShape.nudge`, whole pixels, rounded inwards). It reaches `IslandMap`'s pointer-down callback, never the markup, so the export is unchanged.
  - The range stretches to take in the starting nudge, so a label the clamp already holds (its anchor past the edge) never snaps, or gains a leader, on the first move.
  - A pill wider than the box (a long label at a large size) is pinned by the clamp whatever its nudge, so a drag keeps its nudge on that axis.
- **Decor drag** moves the icon's centre by the drag from where it started, kept half a pixel inside the artboard, then unprojected and rounded to 5 decimals in the edit (`placeAt`).
  - It switches the panel to the island's Decor tab once the press becomes a drag. The prototype switched on pointer-down, so a plain click did too.
  - The stage keeps the map it had.
- **No `_suppress` flag.** A drag can't count as a click, by construction:
  - while placing is armed, the large map gets no `interaction`: no drags, hit rects or grab cursors;
  - otherwise the large map has no click action;
  - Chromium fires the click on the common ancestor of the press and the release, so a drag released over a thumbnail never selects it.
- **Placing** (spec §2 "Adding points"):
  - "⌖ Click map to place" sits beside "+ Add row" (Things to do), "+ Add icon" (Decor) and "+ Add hostel" (Hostels). It reads "Cancel placing" while armed, filled with the accent, as in the prototype.
  - Armed, the large map shows a crosshair and the prototype's dark pill, both on its HTML wrapper, never in the SVG: "Click the island to drop a new spot · Esc to cancel", "Click the map to drop a decor icon · Esc to cancel", "Click the island to drop `<Hostel>` · Esc to cancel", or "Click the island to move `<label>` · Esc to cancel".
  - The next click on the large map places once, with the M4 statuses ("Added — rename it in the list", "Icon added — click it in the list to change the icon", "`<Hostel>` added") or "`<label>` moved".
  - A press that moved 3 px or more places nothing, and placing stays armed. A click on a label places there too; the prototype swallowed it.
  - Any click on the artboard counts, sea included, as in the prototype: the banner's "island" is advice.
  - Esc, the same button, or another tab or island cancels. Esc is heard on the document, like the popovers', so one press also closes an open list.
  - So does its target going away: the row it would move is removed, or the hostel it would drop comes back through "+ Add hostel". The banner never waits for a click the edit would refuse.
  - Armed, the Hostels button cancels instead of opening its list, so it drops `aria-expanded`.
  - Placing leaves the focus alone: the user is on the map, and in the stacked layout focusing the new row would scroll the page away. "+ Add row" still focuses the new name.
  - What each placement does, and its banner and status words, live in one table (`src/editor/placing.ts`), which the add buttons share.
- **Hostel placing: both kinds (the owner's answer, 2026-09-28).**
  - The Hostels tab's "⌖ Click map to place" opens the same list as "+ Add hostel": the island's real hostels that are not on the map (decision 3). Picking one arms placing, and the click drops it with its seed label and label placement (side and nudge, like every other way of moving a point: El Médano's stacked labels stay stacked when their pin is corrected). The button is disabled while every hostel is on the map, which is the case today.
  - Every point row has "⌖ Place on map" under its "Lat, lng": the next click moves that row's point there. Things to do rows have it too, since the row is shared and a spot can't be dragged.
  - Either way the click becomes lat/lng once, to 5 decimals, and the data holds only lat/lng, so pins still come from lat/lng (README ground rules). A hostel placed or moved this way is unverified, since a click only approximates the pin (decision 13), and its "Lat, lng" text follows.
- **Thumbnails** (spec §2 "Clicking a map that isn't selected"):
  - They are native buttons named by their caption ("Gran Canaria · Things to do"). The map inside is hidden from assistive technology, or its every label would join the name.
  - On a map tab, a click selects that island and map, and the tab follows.
  - On the Decor tab, a click selects the island and puts that map on the stage, and the tab stays Decor (the owner's answer, 2026-09-28). The spec says "only the island", but in the prototype all six maps were live; here only the large map can be dragged on, so this is how an icon shown only on Things to do reaches the stage.
  - From the keyboard, focus moves to the large map, since the pressed thumbnail leaves the list. A mouse click moves no focus.
  - Thumbnails still work while placing; another tab or island cancels it.
- **Touch isn't a drag.** A touch scrolls the page, and its `pointercancel` ends the drag. The tool is used at a desk.
- **Keyboard:** labels and icons have no keyboard drag, and there is no keyboard placing. Points move through "Lat, lng" and the side buttons; "+ Add row" and "+ Add icon" add from the keyboard.

## Autosave

- **The draft** is `nest-island-maps.draft` in `localStorage`, holding only the islands whose data differs from their published seed: `{ version: 1, islands: { <id>: { base, data } } }`. `base` is a 32-bit FNV-1a hash of the seed file's bytes (the Download JSON form).
- **A newer seed under a draft** (decision 9): the draft is still shown, with a persistent notice under the header: "`<Island>`: the published map changed since this draft was saved."
  - **Load published** takes the seed.
  - **Keep draft** keeps the edits, which then count as built on the new seed.
  - After an answer, focus goes to the notice line that takes its place, or the one before when the last line was answered, or the panel heading once none are left. It never goes to a button: the next line's first button may be another island's Load published, which a second key press would run. Only a keyboard answer scrolls the heading into view; a mouse answer never jumps the page.
  - Saves keep the old base until one is chosen, so the notice survives edits and reloads.
- **A draft identical to the current seed is dropped silently.** That is the publishing flow (download, commit as the seed, reload), and it must not warn.
- **An unreadable draft is reported, not lost.** An island that fails `parseDataFile` (or a draft that isn't the right shape at all) falls back to the seed, and a persistent notice gives the reason. The unreadable entry stays in storage until that island is edited or the notice is dismissed.
  - The notice goes at the moment an edit replaces the entry: once that island's data differs from its seed (for a whole unreadable draft, once any island's does). A reset back to the seed keeps both.
  - Inside a readable draft, each island's entry is checked on its own, so an odd or unknown entry never voids the others. Entries for islands the app doesn't know are dropped at the next save.
- **Saving:**
  - debounced (400 ms), and flushed on `pagehide`, so an edit followed at once by a reload is kept;
  - skipped when it would write what storage already holds, so opening a second tab never overwrites the first. If two tabs both edit, the last save wins.
  - Reset, Import and Load published count as built on the current seed.
- **Storage that fails never breaks the editor:** every access is guarded. A failed save shows "Couldn’t save in this browser — download the JSON to keep your changes" once, until a save succeeds again.
- **Raw text and resets:** the label and coordinates text lives in row state. Rows are keyed by an island revision that goes up on reset, import and Load published, so text the data never took (an empty, red label) is cleared even when the reset leaves the data as it was.
