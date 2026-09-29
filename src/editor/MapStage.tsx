import { useEffect, useRef, useState, type Ref } from 'react';
import { IslandMap, type MapInteraction } from '../map/IslandMap';
import { loadMapFonts, useFontsVersion } from '../map/fonts';
import { canvasMeasurer } from '../map/measure';
import type { Point } from '../shared/geo';
import { ISLANDS, mapName } from '../shared/islands';
import { ISLAND_IDS, LAYERS, type IslandId, type Layer } from '../shared/schema';
import type { LabelFontId } from '../shared/tokens';
import { isDrag, toArtboard } from './drag';
import { focusSoon } from './focus';
import type { Tab } from './Header';
import { PREVIEW_BACKGROUNDS, type PreviewBackground } from './prefs';
import type { Workspace } from './workspace';

/* The canvas (spec §2): the selected map large, the other five as
   thumbnails, all drawn by the one renderer. The selection outline, the
   preview background, the crosshair and the placing banner live on the HTML
   wrapper, never in the SVG, so none of them can leak into an export. On the
   Decor tab both of the island's maps are outlined, as in the prototype:
   decor belongs to both.

   Only the large map is edited on: it takes the drags (useDrag) or, while
   placing, the click. Each thumbnail is a button that puts its map on the
   stage (spec §2 "Clicking a map that isn't selected"). */

const MAPS = ISLAND_IDS.flatMap((island) => LAYERS.map((layer) => ({ island, layer })));

type MapRef = { island: IslandId; layer: Layer };
/** While placing: the banner's words, and what a click on the large map does, in artboard pixels. */
export type StagePlacing = { banner: string; onPlace: (at: Point) => void };

type MapStageProps = {
  workspace: Workspace;
  island: IslandId;
  layer: Layer;
  tab: Tab;
  background: PreviewBackground;
  /** The large map's drags; left out while placing, so a click can't start one. */
  interaction?: MapInteraction;
  placing?: StagePlacing;
  onSelect: (island: IslandId, layer: Layer) => void;
};
type FontNeed = { font: LabelFontId; labels: string[] };

export function MapStage({ workspace, island, layer, tab, background, interaction, placing, onSelect }: MapStageProps) {
  // Labels are measured, so every face that finishes loading re-renders the maps.
  useFontsVersion();
  const [, setFontsReady] = useState(0);
  // What the maps need loaded: each island's label face and the text it must draw. Slider edits leave this
  // alone; a new face or a label with new characters changes it (fonts load per unicode-range subset).
  const fontNeeds = JSON.stringify(
    ISLAND_IDS.map((id): FontNeed => {
      const d = workspace[id];
      return { font: d.settings.labelFont, labels: [...d.hostels, ...d.attractions].map((i) => i.label) };
    }),
  );
  useEffect(() => {
    let live = true;
    const loads = (JSON.parse(fontNeeds) as FontNeed[]).map((n) => loadMapFonts(n.font, n.labels));
    // Also re-measure once everything is in, in case a face finished before the listener was attached.
    void Promise.all(loads).then(() => live && setFontsReady((n) => n + 1));
    return () => {
      live = false;
    };
  }, [fontNeeds]);

  const large = useRef<HTMLElement>(null);
  const others = MAPS.filter((m) => m.island !== island || m.layer !== layer);

  return (
    <main className="stage">
      <LargeMap
        key={`${island}-${layer}`}
        ref={large}
        island={island}
        layer={layer}
        workspace={workspace}
        background={background}
        interaction={interaction}
        placing={placing}
      />
      <div className="thumbs">
        {others.map((m) => (
          <Thumbnail
            key={`${m.island}-${m.layer}`}
            {...m}
            workspace={workspace}
            background={background}
            selected={tab === 'decor' && m.island === island}
            onClick={(keyboard) => {
              onSelect(m.island, m.layer);
              // The pressed thumbnail leaves the list: a keyboard user goes on from the map it put on the stage.
              if (keyboard) focusSoon(() => large.current);
            }}
          />
        ))}
      </div>
    </main>
  );
}

type LargeMapProps = MapRef & {
  ref: Ref<HTMLElement>;
  workspace: Workspace;
  background: PreviewBackground;
  interaction?: MapInteraction;
  placing?: StagePlacing;
};

/* While placing, a click drops the point; a press that moved 3 px or more
   (the drag threshold) places nothing and leaves placing armed, so a drag
   never counts as a click. */
function LargeMap({ ref, island, layer, workspace, background, interaction, placing }: LargeMapProps) {
  const press = useRef<Point | null>(null);
  return (
    <figure ref={ref} className="map-card map-card-large" data-testid="selected-map" tabIndex={-1}>
      <div
        className={placing ? 'map-frame selected placing' : 'map-frame selected'}
        style={{ background: PREVIEW_BACKGROUNDS[background] }}
        onPointerDown={
          placing &&
          ((e) => {
            press.current = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
          })
        }
        onClick={
          placing &&
          ((e) => {
            const from = press.current;
            press.current = null;
            const svg = e.currentTarget.querySelector('svg');
            if (!from || !svg || isDrag(e.clientX - from.x, e.clientY - from.y)) return;
            placing.onPlace(toArtboard({ x: e.clientX, y: e.clientY }, svg.getBoundingClientRect()));
          })
        }
      >
        <IslandMap geometry={ISLANDS[island].geometry} data={workspace[island]} layer={layer} measure={canvasMeasurer} interaction={interaction} />
        {placing && <p className="placing-banner">{placing.banner}</p>}
      </div>
      <figcaption className="map-caption">{mapName(island, layer)}</figcaption>
    </figure>
  );
}

type ThumbnailProps = MapRef & {
  workspace: Workspace;
  background: PreviewBackground;
  selected: boolean;
  /** `keyboard`: pressed with Enter or Space rather than clicked. */
  onClick: (keyboard: boolean) => void;
};

/* A native button, named by its caption: the map inside is hidden from
   assistive technology, or its every label would join the button's name. */
function Thumbnail({ island, layer, workspace, background, selected, onClick }: ThumbnailProps) {
  return (
    <button type="button" className="map-card map-thumb" onClick={(e) => onClick(e.detail === 0)}>
      <span className={selected ? 'map-frame selected' : 'map-frame'} style={{ background: PREVIEW_BACKGROUNDS[background] }} aria-hidden="true">
        <IslandMap geometry={ISLANDS[island].geometry} data={workspace[island]} layer={layer} measure={canvasMeasurer} />
      </span>
      <span className="map-caption">{mapName(island, layer)}</span>
    </button>
  );
}
