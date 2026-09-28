/* Some controls remove themselves: ×, the Unverified badge, a notice's
   answers, the reset question. Focus on a removed element falls to <body>,
   and a keyboard user starts again from the top. These hand focus on to
   something that stays, once React has committed the change. */

/** Focuses what `target` finds on the next frame, after the re-render. */
export function focusSoon(target: () => HTMLElement | null | undefined, options?: FocusOptions): void {
  requestAnimationFrame(() => target()?.focus(options));
}

/** Before a row is removed: its neighbour's ×, or the list's add button when it was the last row. */
export function focusAfterRemoving(row: Element | null): void {
  const neighbour = row?.nextElementSibling ?? row?.previousElementSibling;
  const target = neighbour?.querySelector<HTMLElement>('.remove') ?? row?.closest('.rows-section')?.querySelector<HTMLElement>('.rows-foot button');
  focusSoon(() => target);
}
