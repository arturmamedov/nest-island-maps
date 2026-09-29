import { useState } from 'react';
import { TAB_LABELS } from '../shared/ids';
import { IconPicker } from './IconPicker';
import { ADDED_SPOT } from './placing';
import { POINT_COLUMNS, PointRow } from './PointRow';
import { PlaceButton, RowsHead, type RowsProps } from './RowControls';
import { addAttraction, setIcon } from './state';

/* The Things to do list: the hostel row plus an icon picker under the name.
   "+ Add row" drops a "New spot" at the artboard centre and focuses its name,
   as the status line suggests ("rename it in the list"). "⌖ Click map to
   place" drops it where the map is clicked instead, and leaves the focus
   alone: the user is on the map, and a narrow layout would scroll away. */

export function AttractionRows({ data, island, onEdit, placing }: RowsProps) {
  const [fresh, setFresh] = useState<string | null>(null);
  const armed = placing.armed?.kind === 'spot';
  return (
    <section className="rows-section" aria-label={TAB_LABELS.attractions}>
      <RowsHead columns={POINT_COLUMNS} />
      <div className="rows">
        {data.attractions.map((a) => (
          <PointRow key={a.id} kind="attractions" itemKey={a.id} item={a} island={island} onEdit={onEdit} placing={placing} fresh={a.id === fresh}>
            <IconPicker value={a.icon} onChange={(icon) => onEdit(setIcon('attractions', a.id, icon))} />
          </PointRow>
        ))}
      </div>
      <div className="rows-foot">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            const r = onEdit(addAttraction(), ADDED_SPOT);
            if (r.ok) setFresh(r.data.attractions.at(-1)!.id);
          }}
        >
          + Add row
        </button>
        <PlaceButton armed={armed} onClick={() => (armed ? placing.cancel() : placing.arm({ kind: 'spot' }))} />
      </div>
    </section>
  );
}
