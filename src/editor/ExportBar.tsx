import { useState } from 'react';
import { ARTBOARD, EXPORT_SCALE } from '../shared/tokens';
import { EXPORTS, type ExportAction, type ExportContext } from './exportActions';

/* The export buttons for the selected map. The note about Figma is the
   spec's (§4): the shadow filter survives in browsers and Illustrator, but
   Figma may drop it on import, which is acceptable once staff know. */

const RASTER = ARTBOARD * EXPORT_SCALE;

type ExportBarProps = {
  ctx: ExportContext;
  /** "Tenerife · Hostels": the map the buttons export, named because the Decor tab isn't a map. */
  mapName: string;
  onStatus: (message: string) => void;
};

export function ExportBar({ ctx, mapName, onStatus }: ExportBarProps) {
  // One export at a time: a second click mid-render would race the first download.
  const [busy, setBusy] = useState(false);

  const run = async (action: ExportAction) => {
    setBusy(true);
    if (action.slow) onStatus('Rendering…');
    try {
      onStatus(await action.run(ctx));
    } catch (e) {
      console.error(e);
      onStatus(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel-section" aria-labelledby="export-title">
      <h2 id="export-title" className="panel-title">
        Export <span className="panel-title-note">{mapName}</span>
      </h2>
      <div className="export-grid">
        {EXPORTS.map((a) => (
          <button key={a.id} type="button" className={`btn btn-${a.look}`} disabled={busy} onClick={() => void run(a)}>
            {a.label}
          </button>
        ))}
      </div>
      <p className="caption">
        PNG keeps the transparent background · JPG is on white · both {`${RASTER} × ${RASTER}`}
      </p>
      <p className="caption">Figma may drop shadow filters</p>
    </section>
  );
}
