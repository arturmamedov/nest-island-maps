import { useEffect, useState } from 'react';
import { IslandMap } from '../map/IslandMap';
import { loadMapFonts, useFontsVersion } from '../map/fonts';
import { canvasMeasurer } from '../map/measure';
import { LAYER_LABELS } from '../shared/ids';
import { ISLANDS } from '../shared/islands';
import { ISLAND_IDS, LAYERS, type IslandId, type Layer } from '../shared/schema';
import { PREVIEW_BACKGROUNDS, type PreviewBackground } from './prefs';
import type { Workspace } from './workspace';

/* The canvas (spec §2): the selected map large, the other five as
   thumbnails, all drawn by the one renderer. The selection outline and the
   preview background live on the HTML wrapper, never in the SVG, so neither
   can leak into an export. Selecting a map by clicking its thumbnail is M5. */

const MAPS = ISLAND_IDS.flatMap((island) => LAYERS.map((layer) => ({ island, layer })));

type MapStageProps = { workspace: Workspace; island: IslandId; layer: Layer; background: PreviewBackground };

export function MapStage({ workspace, island, layer, background }: MapStageProps) {
  // Labels are measured, so every face that finishes loading re-renders the maps.
  useFontsVersion();
  const [, setFontsReady] = useState(0);
  useEffect(() => {
    let live = true;
    const loads = ISLAND_IDS.map((id) => {
      const d = workspace[id];
      return loadMapFonts(d.settings.labelFont, [...d.hostels, ...d.attractions].map((i) => i.label));
    });
    // Also re-measure once everything is in, in case a face finished before the listener was attached.
    void Promise.all(loads).then(() => live && setFontsReady((n) => n + 1));
    return () => {
      live = false;
    };
  }, [workspace]);

  const others = MAPS.filter((m) => m.island !== island || m.layer !== layer);
  const card = (m: { island: IslandId; layer: Layer }, size: 'large' | 'thumb') => (
    <MapCard key={`${m.island}-${m.layer}`} {...m} workspace={workspace} background={background} size={size} selected={size === 'large'} />
  );

  return (
    <main className="stage">
      {card({ island, layer }, 'large')}
      <div className="thumbs">{others.map((m) => card(m, 'thumb'))}</div>
    </main>
  );
}

type MapCardProps = { island: IslandId; layer: Layer; workspace: Workspace; background: PreviewBackground; size: 'large' | 'thumb'; selected: boolean };

function MapCard({ island, layer, workspace, background, size, selected }: MapCardProps) {
  const { name, geometry } = ISLANDS[island];
  return (
    <figure className={`map-card map-card-${size}`}>
      <div className={selected ? 'map-frame selected' : 'map-frame'} style={{ background: PREVIEW_BACKGROUNDS[background] }}>
        <IslandMap geometry={geometry} data={workspace[island]} layer={layer} measure={canvasMeasurer} />
      </div>
      <figcaption>
        {name} · {LAYER_LABELS[layer]}
      </figcaption>
    </figure>
  );
}
