import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IslandMap, type IslandMapProps } from '../map/IslandMap';

/* Plan decision 6: the SVG file is the renderer's own static markup, a pure
   string function testable in Node, so there is no DOM clone-and-strip step
   that could drift from the preview. A line break between tags keeps diffs
   readable; it is safe because no element mixes text and child tags.
   (Font embedding, raster and download are M3.) */

export type MapSvgProps = Omit<IslandMapProps, 'interaction'>;

/** The map as an SVG file: never in edit mode, whatever the caller holds. */
export function renderMapSvg({ geometry, data, layer, measure }: MapSvgProps): string {
  const markup = renderToStaticMarkup(createElement(IslandMap, { geometry, data, layer, measure }));
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + markup.replace(/></g, '>\n<') + '\n';
}
