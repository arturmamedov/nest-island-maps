import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fontEmbedder, type FontEmbedder } from '../map/embedFonts';
import { IslandMap, type IslandMapProps } from '../map/IslandMap';

/* Plan decision 6: the SVG file is the renderer's own static markup, a pure
   string function testable in Node, so there is no DOM clone-and-strip step
   that could drift from the preview. A line break between tags keeps diffs
   readable; it is safe because no element mixes text and child tags.
   This module is the only one that reaches react-dom/server, and the editor
   loads it with a dynamic import at export time, so the editor's main chunk
   doesn't carry the server renderer. */

export type MapSvgProps = Omit<IslandMapProps, 'interaction'>;

/** The map as an SVG file, the "SVG for Figma": never in edit mode, whatever the caller holds, and no fonts. */
export function renderMapSvg({ geometry, data, layer, measure }: MapSvgProps): string {
  const markup = renderToStaticMarkup(createElement(IslandMap, { geometry, data, layer, measure }));
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + markup.replace(/></g, '>\n<') + '\n';
}

/** The same file with its faces embedded as the first child of <svg>: the web SVG, and the source of the PNG and JPG. */
export async function renderWebSvg(props: MapSvgProps, fonts: FontEmbedder = fontEmbedder): Promise<string> {
  const css = await fonts.css(props.data.settings.labelFont);
  return renderMapSvg(props).replace(/<svg[^>]*>\n/, (open) => `${open}<style>${css}</style>\n`);
}
