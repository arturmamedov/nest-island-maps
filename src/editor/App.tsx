import { useState } from 'react';
import { LAYER_LABELS } from '../shared/ids';
import { ISLANDS } from '../shared/islands';
import type { IslandId, Layer } from '../shared/schema';
import { ExportBar } from './ExportBar';
import { Header } from './Header';
import { MapStage } from './MapStage';
import { usePreviewBackground } from './prefs';
import { StatusLine, useStatus } from './StatusLine';
import { seedWorkspace, type Workspace } from './workspace';

/* The editor shell: header, the map stage and the side panel. In M3 the
   workspace is the published seeds and the panel holds the exports; M4 adds
   the data rows, settings and autosave to the same panel. */

type AppState = { workspace: Workspace; island: IslandId; layer: Layer };

const initialState = (): AppState => ({ workspace: seedWorkspace(), island: 'tenerife', layer: 'hostels' });

export function App() {
  const [state, setState] = useState(initialState);
  const [background, setBackground] = usePreviewBackground();
  const [status, showStatus] = useStatus();
  const { workspace, island, layer } = state;
  const data = workspace[island];

  return (
    <div className="app">
      <Header
        island={island}
        layer={layer}
        data={data}
        background={background}
        onIsland={(id) => setState((s) => ({ ...s, island: id }))}
        onLayer={(l) => setState((s) => ({ ...s, layer: l }))}
        onBackground={setBackground}
      />
      <div className="workspace">
        <MapStage workspace={workspace} island={island} layer={layer} background={background} />
        <aside className="panel" aria-label="Selected map">
          <h2 className="panel-heading">
            {ISLANDS[island].name} · {LAYER_LABELS[layer]}
          </h2>
          <ExportBar ctx={{ island, layer, data, geometry: ISLANDS[island].geometry }} onStatus={showStatus} />
          <StatusLine message={status} />
        </aside>
      </div>
    </div>
  );
}
