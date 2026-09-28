import '../map/fonts.css';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { z } from 'zod';
import { IslandMap } from '../map/IslandMap';
import { loadMapFonts } from '../map/fonts';
import { canvasMeasurer } from '../map/measure';
import { parseDataFile } from '../shared/datafile';
import { ISLANDS } from '../shared/islands';
import { IslandIdSchema, LAYERS, SettingsSchema, type Settings } from '../shared/schema';

/* The bare render page (render.html?island=&layer=) that the Playwright
   goldens screenshot: one map, real fonts, nothing else. Tests may inject
   window.__MAP_INPUT through addInitScript to draw other data or settings.
   __MAP_READY means fonts are loaded, the map is measured and painted;
   __MAP_ERROR carries anything that went wrong instead. */

declare global {
  interface Window {
    __MAP_INPUT?: { data?: unknown; settings?: Partial<Settings> };
    __MAP_READY?: boolean;
    __MAP_ERROR?: string;
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function main() {
  const q = new URLSearchParams(location.search);
  const island = IslandIdSchema.parse(q.get('island'));
  const layer = z.enum(LAYERS).parse(q.get('layer'));
  const entry = ISLANDS[island];

  const input = window.__MAP_INPUT ?? {};
  let data = entry.seed;
  if (input.data !== undefined) {
    const r = parseDataFile(input.data, entry);
    if (!r.ok) throw new Error(r.error);
    data = r.data;
  }
  if (input.settings) data = { ...data, settings: SettingsSchema.parse({ ...data.settings, ...input.settings }) };

  const items = layer === 'hostels' ? data.hostels : data.attractions;
  await loadMapFonts(data.settings.labelFont, items.map((i) => i.label));

  // flushSync: the SVG is in the DOM before the frames are counted.
  const root = createRoot(document.getElementById('root')!);
  flushSync(() => root.render(<IslandMap geometry={entry.geometry} data={data} layer={layer} measure={canvasMeasurer} />));
  await nextFrame();
  await nextFrame();
  window.__MAP_READY = true;
}

main().catch((e: unknown) => {
  window.__MAP_ERROR = e instanceof Error ? (e.stack ?? e.message) : String(e);
});
