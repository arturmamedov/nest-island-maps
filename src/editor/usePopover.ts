import { useCallback, useEffect, useId, useRef, useState } from 'react';

/* A button that opens a small panel of choices: the icon picker and
   "+ Add hostel". The panel closes on a choice, on a click or focus anywhere
   else, and on Esc. Esc hands focus back to the trigger, but only when focus
   was inside the panel, so it never steals focus from elsewhere. */

export function usePopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) => target instanceof Node && !!root.current?.contains(target);
    const away = (e: Event) => {
      if (!inside(e.target)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const hadFocus = inside(document.activeElement);
      setOpen(false);
      if (hadFocus) trigger.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('focusin', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('focusin', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  /** Closes after a choice, with focus back on the trigger. */
  const choose = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  /** Spread on the trigger button. */
  const triggerProps = { ref: trigger, 'aria-expanded': open, 'aria-controls': open ? panelId : undefined, onClick: () => setOpen((o) => !o) };

  return { open, root, panelId, triggerProps, choose };
}
