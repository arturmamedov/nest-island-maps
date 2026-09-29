import { useEffect, useRef, type PointerEvent } from 'react';
import type { MapInteraction } from '../map/IslandMap';
import { project, type Point, type ProjectionConstants } from '../shared/geo';
import type { IslandData } from '../shared/schema';
import { artboardScale, decorTarget, isDrag, nudgeFor } from './drag';
import type { OnEdit } from './RowControls';
import { placeAt, setNudge } from './state';

/* Dragging on the large map (spec §2 "Dragging"): a label moves its nudge, a
   decor icon its lat/lng. A press becomes a drag only past 3 screen pixels,
   so a click stays a click. What was pressed captures the pointer, so the
   drag follows it off the map and keeps its grab or move cursor; the moves
   and the release are heard on the window, so a capture that fails or is
   lost can't leave a drag running. Each move is an ordinary edit through the
   App (held to the schema, autosaved after the debounce), computed from the
   press rather than from the last move, so no move builds on a stale one. */

type DragOptions = {
  /** The selected island's data, for where a label's nudge or an icon starts. */
  data: IslandData;
  projection: ProjectionConstants;
  onEdit: OnEdit;
  /** A decor icon started moving: its list is the island's Decor tab (spec §2). */
  onDecorDrag: () => void;
};

type Gesture = {
  /** Once, when the press becomes a drag. */
  onStart?: () => void;
  /** Every move after that, with the drag so far in artboard pixels. */
  onMove: (delta: Point) => void;
};

/** The large map's drags: labels move their nudge, decor icons their lat/lng, once a press passes 3 px. */
export function useDrag({ data, projection, onEdit, onDecorDrag }: DragOptions): MapInteraction {
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  function begin(e: PointerEvent<SVGGElement>, gesture: Gesture) {
    const svg = e.currentTarget.ownerSVGElement;
    if (e.button !== 0 || !e.isPrimary || !svg) return;
    active.current?.abort();
    const stop = new AbortController();
    active.current = stop;

    const scale = artboardScale(svg.getBoundingClientRect().width);
    const { pointerId, clientX: x0, clientY: y0 } = e;
    const target = e.currentTarget;
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // The window listeners below carry the drag without it.
    }
    stop.signal.addEventListener('abort', () => {
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    });

    let dragging = false;
    const end = () => stop.abort();
    const move = (m: globalThis.PointerEvent) => {
      if (m.pointerId !== pointerId) return;
      // The button came up where no pointerup reached us.
      if ((m.buttons & 1) === 0) return end();
      const dx = m.clientX - x0;
      const dy = m.clientY - y0;
      if (!dragging) {
        if (!isDrag(dx, dy)) return;
        dragging = true;
        gesture.onStart?.();
      }
      gesture.onMove({ x: dx * scale, y: dy * scale });
    };
    const up = (u: globalThis.PointerEvent) => {
      if (u.pointerId === pointerId) end();
    };
    window.addEventListener('pointermove', move, { signal: stop.signal });
    window.addEventListener('pointerup', up, { signal: stop.signal });
    window.addEventListener('pointercancel', up, { signal: stop.signal });
  }

  /** Whether a result differs from the last one sent: a label held at the edge of the box would repeat the same edit. */
  const changes = () => {
    let last = '';
    return (result: string) => {
      if (result === last) return false;
      last = result;
      return true;
    };
  };

  return {
    onLabelPointerDown: (e, { layer, key, nudge }) => {
      const item = layer === 'hostels' ? data.hostels.find((h) => h.slug === key) : data.attractions.find((a) => a.id === key);
      if (!item) return;
      const start = item.labelPlacement;
      const changed = changes();
      changed(`${start.dx} ${start.dy}`);
      begin(e, {
        onMove: (delta) => {
          const n = nudgeFor(start, delta, nudge);
          if (changed(`${n.dx} ${n.dy}`)) onEdit(setNudge(layer, key, n));
        },
      });
    },
    onDecorPointerDown: (e, key) => {
      const icon = data.decor.find((d) => d.id === key);
      if (!icon) return;
      const from = project(projection, icon.lat, icon.lng);
      const changed = changes();
      begin(e, {
        onStart: onDecorDrag,
        onMove: (delta) => {
          const to = decorTarget(from, delta);
          if (changed(`${to.x} ${to.y}`)) onEdit(placeAt('decor', key, to));
        },
      });
    },
  };
}
