import { useState } from 'react';

/* The row inputs let staff type what the data can't hold yet: half a pair of
   coordinates, an empty label on the way to a new one (plan decision 13, and
   the same pattern for labels). The raw text lives here, in row state, and the
   data only changes when the text parses.

   The hook remembers the value it last committed, so the data's normalised
   form ("El" for a typed "El ") never overwrites what is being typed. When
   the value changes from anywhere else (Load published, or a drag in M5), the
   text follows it. A reset that leaves the value as it was can't be seen
   here: the rows are keyed by the island's revision, so they remount. */

/** The text to show, and a setter that also records the value the text committed (if it parsed). */
export function useRawText<T>(value: T, format: (value: T) => string, same: (a: T, b: T) => boolean = Object.is) {
  const [state, setState] = useState(() => ({ text: format(value), value }));
  if (!same(state.value, value)) {
    // Changed from outside: adopt it. (Setting state while rendering is React's pattern for this.)
    const next = { text: format(value), value };
    setState(next);
    return [next.text, setter(setState)] as const;
  }
  return [state.text, setter(setState)] as const;
}

type RawState<T> = { text: string; value: T };

function setter<T>(setState: (update: (s: RawState<T>) => RawState<T>) => void) {
  return (text: string, committed?: { value: T }) => setState((s) => ({ text, value: committed ? committed.value : s.value }));
}
