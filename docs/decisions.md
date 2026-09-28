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
