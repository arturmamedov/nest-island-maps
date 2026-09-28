import { useRef, useState } from 'react';
import { focusSoon } from './focus';

/* The island file as a whole (spec §3 "Storage (v1)"): Import JSON replaces
   the selected island with a downloaded file, and Reset island goes back to
   the published seed. Reset asks first, inline (plan decision 12); the
   prototype reset at once. Publishing stays Download JSON, then commit. */

type IslandActionsProps = {
  islandName: string;
  /** A parsed JSON file; the App validates it for this island. */
  onImport: (json: unknown) => void;
  onReset: () => void;
  onStatus: (message: string) => void;
};

export function IslandActions({ islandName, onImport, onReset, onStatus }: IslandActionsProps) {
  const input = useRef<HTMLInputElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);

  const read = async (file: File) => {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      onStatus('Import failed: that file is not JSON');
      return;
    }
    onImport(json);
  };

  // The question replaces the button: focus goes to Cancel, the safe answer, and comes back after either answer.
  const answer = (reset: boolean) => {
    setConfirming(false);
    if (reset) onReset();
    focusSoon(() => resetButton.current);
  };

  return (
    <section className="panel-section" aria-labelledby="island-file-title">
      <h2 id="island-file-title" className="panel-title">
        Island data
      </h2>
      <p className="caption island-file-caption">Edits save in this browser. To publish, download the JSON and commit it to the repo.</p>
      {confirming ? (
        <div className="confirm" role="group" aria-label="Reset island" aria-describedby="reset-question">
          <p id="reset-question">Reset {islandName} to the published map? Edits to both maps are lost.</p>
          <div className="button-row">
            <button type="button" className="btn btn-danger" onClick={() => answer(true)}>
              Reset
            </button>
            <button type="button" className="btn btn-quiet" autoFocus onClick={() => answer(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="button-row">
          <button type="button" className="btn btn-outline" onClick={() => input.current?.click()}>
            Import JSON
          </button>
          <button ref={resetButton} type="button" className="btn btn-quiet" onClick={() => setConfirming(true)}>
            Reset island
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared at once, so choosing the same file again still counts as a change.
          e.target.value = '';
          if (file) void read(file);
        }}
      />
    </section>
  );
}
