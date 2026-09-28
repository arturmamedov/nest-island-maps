import { downloadBlob } from '../export/download';
import { dataFileBlob } from '../export/json';
import { rasterise, type RasterFormat } from '../export/raster';
import { loadMapFonts } from '../map/fonts';
import { canvasMeasurer } from '../map/measure';
import { dataFileName, mapFileName } from '../shared/filename';
import type { Geometry, IslandData, IslandId, Layer } from '../shared/schema';

/* The export buttons as data (handoff README §4): each one names its button
   and returns the status line's confirmation. Every map file comes from the
   one renderer through src/export/svg.ts, which is imported dynamically: it
   is the only route to react-dom/server, so the server renderer loads in its
   own chunk on the first export instead of weighing on the editor. */

export type ExportContext = { island: IslandId; layer: Layer; data: IslandData; geometry: Geometry };

export type ExportAction = {
  id: 'svg' | 'webSvg' | 'copy' | 'png' | 'jpg' | 'json';
  label: string;
  look: 'primary' | 'outline' | 'quiet';
  /** Slow enough to show "Rendering…" first. */
  slow?: boolean;
  run: (ctx: ExportContext) => Promise<string>;
};

/** The SVG module and the map's props, with the label face loaded so labels measure true. */
async function prepare(ctx: ExportContext) {
  const items = ctx.layer === 'hostels' ? ctx.data.hostels : ctx.data.attractions;
  await loadMapFonts(ctx.data.settings.labelFont, items.map((i) => i.label));
  const svg = await import('../export/svg');
  return { svg, props: { geometry: ctx.geometry, data: ctx.data, layer: ctx.layer, measure: canvasMeasurer } };
}

const svgBlob = (text: string) => new Blob([text], { type: 'image/svg+xml' });

async function raster(ctx: ExportContext, format: RasterFormat): Promise<string> {
  const { svg, props } = await prepare(ctx);
  const blob = await rasterise(await svg.renderWebSvg(props), format);
  downloadBlob(blob, mapFileName(ctx.island, ctx.layer, format));
  return `${format.toUpperCase()} downloaded`;
}

export const EXPORTS: readonly ExportAction[] = [
  {
    id: 'svg',
    label: 'SVG (Figma)',
    look: 'primary',
    run: async (ctx) => {
      const { svg, props } = await prepare(ctx);
      downloadBlob(svgBlob(svg.renderMapSvg(props)), mapFileName(ctx.island, ctx.layer, 'svg'));
      return 'SVG downloaded';
    },
  },
  {
    id: 'webSvg',
    label: 'SVG for web',
    look: 'primary',
    run: async (ctx) => {
      const { svg, props } = await prepare(ctx);
      downloadBlob(svgBlob(await svg.renderWebSvg(props)), mapFileName(ctx.island, ctx.layer, 'webSvg'));
      return 'Web SVG downloaded';
    },
  },
  {
    id: 'copy',
    label: 'Copy SVG',
    look: 'outline',
    // The Figma SVG: it pastes into Figma or code, and carries no base64 fonts.
    run: async (ctx) => {
      const { svg, props } = await prepare(ctx);
      try {
        await navigator.clipboard.writeText(svg.renderMapSvg(props));
        return 'SVG copied — paste into Figma or code';
      } catch {
        return 'Clipboard blocked here — use SVG (Figma) instead';
      }
    },
  },
  { id: 'png', label: 'PNG', look: 'primary', slow: true, run: (ctx) => raster(ctx, 'png') },
  { id: 'jpg', label: 'JPG', look: 'primary', slow: true, run: (ctx) => raster(ctx, 'jpg') },
  {
    id: 'json',
    label: 'Download JSON',
    look: 'quiet',
    run: async (ctx) => {
      downloadBlob(dataFileBlob(ctx.data, ctx.geometry), dataFileName(ctx.island));
      return 'Data downloaded';
    },
  },
];
