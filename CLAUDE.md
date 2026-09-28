# CLAUDE.md — Nest Island Maps

Internal tool that renders Nests Hostels island maps from data and exports SVG, PNG, JPG and JSON. Read `README.md` and `design_handoff_island_maps/README.md` (the spec) before changing anything visual or structural.

## Architecture

- `src/map/IslandMap.tsx` is **the only renderer**: a pure function of (geometry, data, settings), with inline styles and SVG attributes. Never add a second one, whether a canvas redraw or a server template.
- `src/shared/`: the projection (`project`/`unproject`), label metrics, clustering, the zod schema (source of truth), the icon set. It is DOM-free except for text measurement, which sits behind one function.
- `src/editor/`: the editor shell, lists, drag, placing, settings, autosave.
- `src/export/`: SVG serialiser, PNG/JPG rasteriser with embedded self-hosted fonts.
- `data/geometry/`: generated once by `scripts/build-geometry.ts`, then committed. Don't edit it by hand.
- `data/seed/`: per-island data. Edits go through the app, then Download JSON, then commit.

## Non-negotiables

- **Labels:** Roboto Condensed 700, 25px, tracking 0.19em by default. Text is stored as typed (mixed case) and uppercased in JS at render, never with CSS, so the exported SVG carries capitals.
- **Pin shadow:** black 25%, spread 5%, size 9px (see the filter in the spec).
- **Rings:** stacked opacities 0.2 / 0.3 / 0.5 / 1.0 on a transparent background.
- **Clustering:** hostels closer than 14px share one pin.
- **Attribution:** "© OpenStreetMap contributors" stays on published maps.
- **Hostel identity:** slugs come from the flyers repo's `seed/hostels.json`; never invent names. Coordinates stay flagged unverified until the owner confirms them.
- **Ibiza firewall:** no Nest Pass content on any Ibiza map.

## How to work here

- SOLID and DRY (the owner's standing rule); one source of truth per fact.
- Match the flyers repo's conventions: TypeScript throughout, functional state updates, and comments that explain *why*.
- Before calling work done, run typecheck, unit tests and the render/export checks, and look at an exported PNG in Chrome.
- Git: work on a feature branch, commit only when asked, never push unasked.
