import { useCallback, useEffect, useRef, useState } from 'react';

/* Short confirmations such as "PNG downloaded" (spec §2), gone after 3.2 s.
   A new message restarts the clock, so a quick second export is never
   cleared early by the first one's timer. */

export const STATUS_MS = 3200;

/** The current message and a function that shows one. */
export function useStatus(): [string, (message: string) => void] {
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current);
    setMessage(next);
    timer.current = window.setTimeout(() => setMessage(''), STATUS_MS);
  }, []);

  return [message, show];
}

export function StatusLine({ message }: { message: string }) {
  return (
    <p className="status" role="status" aria-live="polite">
      {message}
    </p>
  );
}
