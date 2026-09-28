import { useEffect, useState } from 'react';
import { LAYER_LABELS } from '../shared/ids';
import { ISLANDS } from '../shared/islands';
import { ISLAND_IDS, type IslandData, type IslandId, type Layer } from '../shared/schema';
import { AttractionRows } from './AttractionRows';
import { createDraftStore, type Bases, type DraftProblem, type DraftStore } from './autosave';
import { browserStorage } from './browserStorage';
import { DecorRows } from './DecorRows';
import { DraftNotice, PANEL_HEADING_ID } from './DraftNotice';
import { ExportBar } from './ExportBar';
import { Header, type Tab } from './Header';
import { HostelRows } from './HostelRows';
import { IslandActions } from './IslandActions';
import { MapStage } from './MapStage';
import { usePreviewBackground } from './prefs';
import type { OnEdit, RowsProps } from './RowControls';
import { RouteRows } from './RouteRows';
import { SettingsPanel } from './SettingsPanel';
import { applyEdit, importFile, resetIsland, setSettings, tryEdit, type EditResult, type IslandEdit } from './state';
import { StatusLine, useStatus } from './StatusLine';
import type { Workspace } from './workspace';

/* The editor shell (spec §2): header, the draft notices, the map stage and
   the side panel with the rows, settings, exports and the island file. The
   three islands' data is one Workspace, changed only by the pure edits of
   state.ts through functional updates, and autosaved to this browser. */

type AppState = {
  workspace: Workspace;
  /** The seed hash each island's data was built on (autosave.ts). */
  bases: Bases;
  /** Goes up when an island is reset or replaced, so its rows and their raw text start over. */
  revisions: Record<IslandId, number>;
  /** Drafts that could not be read, until dismissed or replaced by new edits. */
  problems: DraftProblem[];
  island: IslandId;
  tab: Tab;
  /** The map on the stage; the Decor tab keeps the last one. */
  layer: Layer;
};

const SAVE_FAILED = 'Couldn’t save in this browser — download the JSON to keep your changes';

function initialState(store: DraftStore): AppState {
  const { workspace, bases, problems } = store.load();
  const revisions = Object.fromEntries(ISLAND_IDS.map((id) => [id, 0])) as Record<IslandId, number>;
  return { workspace, bases, revisions, problems, island: 'tenerife', tab: 'hostels', layer: 'hostels' };
}

export function App() {
  const [status, showStatus] = useStatus();
  const [store] = useState(() => createDraftStore(browserStorage(), { onSaveError: () => showStatus(SAVE_FAILED) }));
  const [state, setState] = useState(() => initialState(store));
  const [background, setBackground] = usePreviewBackground();
  const { workspace, bases, island, tab, layer } = state;
  const entry = ISLANDS[island];
  const data = workspace[island];

  useEffect(() => {
    store.save({ workspace, bases });
  }, [store, workspace, bases]);

  // An edit followed at once by a reload or a closed tab is still saved.
  useEffect(() => {
    const flush = () => store.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [store]);

  /* An unreadable draft of an island is replaced once that island's data
     differs from its seed (autosave.ts), and a whole unreadable draft once any
     island does: their notices go at the same moment. */
  const settle = (problems: DraftProblem[], id: IslandId, data: IslandData) =>
    store.isSeed(id, data) ? problems : problems.filter((p) => p.island !== undefined && p.island !== id);

  /* The result of the render's state picks the message; the update itself
     runs the edit again on the latest state, so it stays a pure function. */
  const edit: OnEdit = (e, done) => {
    const r = tryEdit(data, entry, e);
    if (!r.ok) {
      showStatus(r.error);
      return r;
    }
    setState((s) => {
      const workspace = applyEdit(s.workspace, entry, e);
      return { ...s, workspace, problems: settle(s.problems, island, workspace[island]) };
    });
    const message = r.note ?? done;
    if (message) showStatus(message);
    return r;
  };

  /** Reset, Import and Load published: the island's new data counts as built on the current seed, and its rows start over. */
  const replaceIsland = (id: IslandId, e: IslandEdit): EditResult => {
    const target = ISLANDS[id];
    const r = tryEdit(workspace[id], target, e);
    if (r.ok) {
      setState((s) => {
        const workspace = applyEdit(s.workspace, target, e);
        return {
          ...s,
          workspace,
          bases: store.rebase(s.bases, id),
          revisions: { ...s.revisions, [id]: s.revisions[id] + 1 },
          problems: settle(s.problems, id, workspace[id]),
        };
      });
    }
    return r;
  };

  const reset = () => {
    const r = replaceIsland(island, resetIsland());
    showStatus(r.ok ? `${entry.name} back to defaults` : r.error);
  };

  const importJson = (json: unknown) => {
    const r = replaceIsland(island, importFile(json));
    showStatus(r.ok ? `${entry.name} imported` : `Import failed: ${r.error}`);
  };

  const loadPublished = (id: IslandId) => {
    const r = replaceIsland(id, resetIsland());
    showStatus(r.ok ? `${ISLANDS[id].name}: published map loaded` : r.error);
  };

  const keepDraft = (id: IslandId) => {
    setState((s) => ({ ...s, bases: store.rebase(s.bases, id) }));
    showStatus(`${ISLANDS[id].name}: keeping your draft`);
  };

  const dismiss = (problem: DraftProblem) => {
    store.dismiss(problem.island);
    setState((s) => ({ ...s, problems: s.problems.filter((p) => p.island !== problem.island) }));
  };

  const selectTab = (t: Tab) => setState((s) => ({ ...s, tab: t, layer: t === 'decor' ? s.layer : t }));

  const rows: RowsProps = { data, island: entry, onEdit: edit };

  return (
    <div className="app">
      <Header island={island} tab={tab} data={data} onIsland={(id) => setState((s) => ({ ...s, island: id }))} onTab={selectTab} />
      <DraftNotice stale={store.stale(bases)} problems={state.problems} onLoadPublished={loadPublished} onKeepDraft={keepDraft} onDismiss={dismiss} />
      <div className="workspace">
        <MapStage workspace={workspace} island={island} layer={layer} tab={tab} background={background} />
        <aside className="panel" aria-label="Map data">
          <div className="panel-scroll">
            <div className="panel-intro">
              <p className="eyebrow">
                <span className="tag">Data</span> Edit, add, remove · saved in this browser
              </p>
              <h2 id={PANEL_HEADING_ID} className="panel-heading" tabIndex={-1}>
                Map data
              </h2>
              <p className="lede">Paste coordinates straight from Google Maps (right-click a place → copy the numbers). Pins land in the right spot automatically.</p>
            </div>

            {/* Keyed by tab, island and revision: rows hold raw text, ids repeat across islands (every island has a
                "sun"), and a reset or import must start the rows over even where the data didn't change. */}
            <div key={`${tab}:${island}:${state.revisions[island]}`}>
              {tab === 'hostels' && <HostelRows {...rows} />}
              {tab === 'attractions' && <AttractionRows {...rows} />}
              {tab === 'decor' && (
                <>
                  <DecorRows {...rows} />
                  <RouteRows {...rows} />
                </>
              )}
            </div>

            <SettingsPanel
              settings={data.settings}
              islandName={entry.name}
              onChange={(patch) => edit(setSettings(patch))}
              background={background}
              onBackground={setBackground}
            />
            <ExportBar ctx={{ island, layer, data, geometry: entry.geometry }} mapName={`${entry.name} · ${LAYER_LABELS[layer]}`} onStatus={showStatus} />
            {/* Keyed by island, so a half-answered reset never carries over to another island. */}
            <IslandActions key={`actions:${island}`} islandName={entry.name} onImport={importJson} onReset={reset} onStatus={showStatus} />
          </div>
          <StatusLine message={status} />
        </aside>
      </div>
    </div>
  );
}
