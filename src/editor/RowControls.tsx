import type { ComponentProps } from 'react';
import { SHOW_ON_LABELS } from '../shared/ids';
import type { IslandEntry } from '../shared/islands';
import { parseLabel, SIDES, type IslandData, type IslandId, type ShowOn, type Side } from '../shared/schema';
import { focusAfterRemoving } from './focus';
import { CANCEL_PLACING, PLACE } from './placing';
import type { EditResult, IslandEdit } from './state';
import type { Placing } from './usePlacing';
import { useRawText } from './useRawText';

/* The controls every data row shares (spec §2 "Interactions", the prototype's
   turn 2 rows): the visibility dot, the name input, the label-side buttons,
   Show on and ×. Each row kind (HostelRows, AttractionRows, DecorRows,
   RouteRows) lays them out in its own grid. */

/** How a row asks for an edit: the App applies it, shows the refusal or `done`, and returns the result. */
export type OnEdit = (edit: IslandEdit, done?: string) => EditResult;

/** What every list of rows gets from the App. The App remounts the lists when the island is reset or replaced. */
export type RowsProps = { data: IslandData; island: IslandEntry; onEdit: OnEdit; placing: Placing };

/** The 18 px dot: filled when the row is on the map. */
export function VisibilityToggle({ visible, onChange }: { visible: boolean; onChange: (visible: boolean) => void }) {
  return <button type="button" className="toggle" aria-pressed={visible} aria-label="Visible" title="Show / hide" onClick={() => onChange(!visible)} />;
}

const SIDE_GLYPHS: Record<Side, string> = { below: '↓', above: '↑', right: '→', left: '←' };

/** Which side of its marker a label hangs; choosing a new one clears the drag nudge. */
export function SideButtons({ side, onChange }: { side: Side; onChange: (side: Side) => void }) {
  return (
    <div className="sides" role="group" aria-label="Label side">
      {SIDES.map((s) => (
        <button key={s} type="button" aria-pressed={s === side} aria-label={`Label ${s}`} title={`Label ${s}`} onClick={() => onChange(s)}>
          {SIDE_GLYPHS[s]}
        </button>
      ))}
    </div>
  );
}

/** × removes its row at once, as in the prototype; focus moves on to a neighbour. */
export function RemoveButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="remove"
      aria-label={`Remove ${name}`}
      title="Remove"
      onClick={(e) => {
        focusAfterRemoving(e.currentTarget.closest('.row'));
        onClick();
      }}
    >
      ×
    </button>
  );
}

/** Both maps → Hostels → Things to do, one click at a time. */
export function ShowOnButton({ showOn, onClick }: { showOn: ShowOn; onClick: () => void }) {
  return (
    <button type="button" className="showon" aria-label={`Show on: ${SHOW_ON_LABELS[showOn]}`} title="Which maps show it" onClick={onClick}>
      {SHOW_ON_LABELS[showOn]}
    </button>
  );
}

type LabelInputProps = {
  value: string;
  island: IslandId;
  onCommit: (text: string) => void;
  /** A row just added: focus its name, selected, ready to be typed over. */
  fresh?: boolean;
};

/* A label that the file would refuse (empty, over 40 characters, a glyph the
   fonts lack, Nest Pass on Ibiza) stays in the input, red, with the reason
   on hover; the map keeps the last good label until the text parses. */
export function LabelInput({ value, island, onCommit, fresh }: LabelInputProps) {
  const [text, setText] = useRawText(value, (v) => v);
  const check = parseLabel(text, island);
  return (
    <input
      className="input"
      aria-label="Name"
      value={text}
      aria-invalid={!check.ok}
      title={check.ok ? undefined : check.error}
      autoFocus={fresh}
      onFocus={fresh ? (e) => e.currentTarget.select() : undefined}
      onChange={(e) => {
        const next = e.target.value;
        const r = parseLabel(next, island);
        setText(next, r.ok ? { value: r.label } : undefined);
        if (r.ok && r.label !== value) onCommit(next);
      }}
    />
  );
}

/** "⌖ Click map to place" beside a list's add button (the prototype's); it reads "Cancel placing" while armed. */
export function PlaceButton({ armed, className, ...props }: ComponentProps<'button'> & { armed: boolean }) {
  return (
    <button type="button" className={['btn btn-outline', armed && 'btn-armed', className].filter(Boolean).join(' ')} {...props}>
      {armed ? CANCEL_PLACING : PLACE}
    </button>
  );
}

/** The column headings above a list of rows; `decor` for the decor and route grid. */
export function RowsHead({ columns, decor }: { columns: readonly string[]; decor?: boolean }) {
  return (
    <div className={decor ? 'rows-head rows-head-decor' : 'rows-head'} aria-hidden="true">
      {columns.map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </div>
  );
}
