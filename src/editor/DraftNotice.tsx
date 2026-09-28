import type { MouseEvent } from 'react';
import { ISLANDS } from '../shared/islands';
import type { IslandId } from '../shared/schema';
import type { DraftProblem } from './autosave';
import { focusSoon } from './focus';

/* The persistent notices about the saved draft (plan decision 9). They stay
   until someone chooses, unlike the 3.2 s status line, because each one asks
   for a decision about work that would otherwise be lost or hidden:
   - a newer published seed arrived under an island's draft: load it, or keep
     the draft (which then counts as built on the new seed);
   - a draft couldn't be read: the published map is shown instead, and the
     unreadable draft stays in storage until dismissed or replaced by an edit. */

type DraftNoticeProps = {
  stale: readonly IslandId[];
  problems: readonly DraftProblem[];
  onLoadPublished: (island: IslandId) => void;
  onKeepDraft: (island: IslandId) => void;
  onDismiss: (problem: DraftProblem) => void;
};

/** The id of the side panel's heading, where focus goes when the last notice is answered. */
export const PANEL_HEADING_ID = 'map-data-title';

export function DraftNotice({ stale, problems, onLoadPublished, onKeepDraft, onDismiss }: DraftNoticeProps) {
  if (stale.length === 0 && problems.length === 0) return null;
  /* Each answer removes its own line. Focus moves to the line that takes its
     place (or the one before), never to a button: the next line's first
     button may be another island's "Load published", which a second key
     press would run. With no line left, focus goes to the panel; only a
     keyboard answer (a click with detail 0) scrolls it into view, so a mouse
     answer never jumps the page away from the map. */
  const answer = (act: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    const at = [...document.querySelectorAll('.notice-line')].indexOf(e.currentTarget.closest('.notice-line')!);
    const byPointer = e.detail > 0;
    act();
    focusSoon(
      () => {
        const left = document.querySelectorAll<HTMLElement>('.notice-line');
        return left[Math.min(at, left.length - 1)] ?? document.getElementById(PANEL_HEADING_ID);
      },
      { preventScroll: byPointer },
    );
  };
  return (
    <div className="notice" role="alert">
      {stale.map((id) => (
        <p key={id} className="notice-line" tabIndex={-1}>
          <span>
            <strong>{ISLANDS[id].name}</strong>: the published map changed since this draft was saved.
          </span>
          <button type="button" className="btn btn-primary" onClick={answer(() => onLoadPublished(id))}>
            Load published
          </button>
          <button type="button" className="btn btn-outline" onClick={answer(() => onKeepDraft(id))}>
            Keep draft
          </button>
        </p>
      ))}
      {problems.map((p) => (
        <p key={p.island ?? 'draft'} className="notice-line notice-problem" tabIndex={-1}>
          <span>
            {p.island ? (
              <>
                <strong>{ISLANDS[p.island].name}</strong>: the saved draft couldn’t be read ({p.error}), so this is the published map.
              </>
            ) : (
              `The saved draft couldn’t be read (${p.error}), so these are the published maps.`
            )}
          </span>
          <button type="button" className="btn btn-quiet" onClick={answer(() => onDismiss(p))}>
            Dismiss
          </button>
        </p>
      ))}
    </div>
  );
}
