import { LAYER_LABELS } from '../shared/ids';
import { ISLAND_LIST } from '../shared/islands';
import { LAYERS, type IslandData, type IslandId, type Layer } from '../shared/schema';
import { PREVIEW_BACKGROUND_LABELS, type PreviewBackground } from './prefs';

/* The island and map switchers (spec §2), plus the preview background until
   M4's settings panel takes it. The Decor tab arrives with its rows in M4.
   Map tabs show how many points are visible, as the prototype did. */

type HeaderProps = {
  island: IslandId;
  layer: Layer;
  data: IslandData;
  background: PreviewBackground;
  onIsland: (island: IslandId) => void;
  onLayer: (layer: Layer) => void;
  onBackground: (background: PreviewBackground) => void;
};

const visibleCount = (data: IslandData, layer: Layer) => (layer === 'hostels' ? data.hostels : data.attractions).filter((i) => i.visible).length;

export function Header({ island, layer, data, background, onIsland, onLayer, onBackground }: HeaderProps) {
  return (
    <header className="header">
      <h1 className="title">Nest Island Maps</h1>

      <div className="segmented" role="tablist" aria-label="Island">
        {ISLAND_LIST.map((i) => (
          <button key={i.id} type="button" role="tab" aria-selected={i.id === island} onClick={() => onIsland(i.id)}>
            {i.name}
          </button>
        ))}
      </div>

      <div className="tabs" role="tablist" aria-label="Map">
        {LAYERS.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={l === layer} onClick={() => onLayer(l)}>
            {LAYER_LABELS[l]} · {visibleCount(data, l)}
          </button>
        ))}
      </div>

      <div className="preview-toggle" role="group" aria-label="Preview background">
        <span className="muted">Preview</span>
        {(Object.keys(PREVIEW_BACKGROUND_LABELS) as PreviewBackground[]).map((b) => (
          <button key={b} type="button" className="chip" aria-pressed={b === background} onClick={() => onBackground(b)}>
            {PREVIEW_BACKGROUND_LABELS[b]}
          </button>
        ))}
      </div>
    </header>
  );
}
