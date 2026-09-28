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
- **Access:** internal only until the shared staff login exists.
