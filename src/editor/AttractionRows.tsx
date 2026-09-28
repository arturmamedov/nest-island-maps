import { useState } from 'react';
import { TAB_LABELS } from '../shared/ids';
import { IconPicker } from './IconPicker';
import { POINT_COLUMNS, PointRow } from './PointRow';
import { RowsHead, type RowsProps } from './RowControls';
import { addAttraction, setIcon } from './state';

/* The Things to do list: the hostel row plus an icon picker under the name.
   "+ Add row" drops a "New spot" at the artboard centre and focuses its name,
   as the status line suggests ("rename it in the list"). Click-to-place is M5. */

export function AttractionRows({ data, island, onEdit }: RowsProps) {
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <section className="rows-section" aria-label={TAB_LABELS.attractions}>
      <RowsHead columns={POINT_COLUMNS} />
      <div className="rows">
        {data.attractions.map((a) => (
          <PointRow key={a.id} kind="attractions" itemKey={a.id} item={a} island={island} onEdit={onEdit} fresh={a.id === fresh}>
            <IconPicker value={a.icon} onChange={(icon) => onEdit(setIcon('attractions', a.id, icon))} />
          </PointRow>
        ))}
      </div>
      <div className="rows-foot">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            const r = onEdit(addAttraction(), 'Added — rename it in the list');
            if (r.ok) setFresh(r.data.attractions.at(-1)!.id);
          }}
        >
          + Add row
        </button>
      </div>
    </section>
  );
}
