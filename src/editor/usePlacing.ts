import { useEffect, useState } from 'react';
import type { IslandData, IslandId } from '../shared/schema';
import type { Tab } from './Header';
import { placementApplies, type Placement } from './placing';

/* Placing is armed from a list and happens on the stage, so the App holds it.
   It belongs to the tab and island that armed it: changing either cancels it,
   as in the prototype, and so do Esc and the button that armed it, and so
   does its target going away (placementApplies). One click on the map places
   once (the App cancels after it). Esc is heard on the document, like the
   popovers': one press closes an open list too. */

/** The armed placement, if any, and how to arm or cancel it. */
export type Placing = {
  /** What the next click on the large map does, or null. */
  armed: Placement | null;
  arm: (placement: Placement) => void;
  cancel: () => void;
};

type Armed = { placement: Placement; tab: Tab; island: IslandId };

/** Placing for the selected island (`data`) on the current tab. */
export function usePlacing(tab: Tab, island: IslandId, data: IslandData): Placing {
  const [state, setState] = useState<Armed | null>(null);
  const current = state !== null && state.tab === tab && state.island === island && placementApplies(state.placement, data);
  // Another tab or island, or nothing left to place: cancelled. (Setting state while rendering is React's pattern for this.)
  if (state !== null && !current) setState(null);
  const armed = current ? state.placement : null;

  useEffect(() => {
    if (!armed) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState(null);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [armed]);

  return { armed, arm: (placement) => setState({ placement, tab, island }), cancel: () => setState(null) };
}
