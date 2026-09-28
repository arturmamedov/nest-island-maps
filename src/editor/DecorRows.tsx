import { ICONS } from '../shared/icons';
import { DECOR_SIZE } from '../shared/tokens';
import { IconPicker } from './IconPicker';
import { RemoveButton, RowsHead, ShowOnButton, VisibilityToggle, type RowsProps } from './RowControls';
import { addDecor, cycleShowOn, remove, setDecorSize, setIcon, setVisible } from './state';

/* The Decor tab's icon rows (spec §2): toggle, icon, size 20–140, Show on, ×.
   Decor is shared by an island's two maps; Show on says which. Dragging an
   icon on the map is M5. */

/** The prototype's slider step. */
const SIZE_STEP = 2;

export function DecorRows({ data, onEdit }: RowsProps) {
  return (
    <section className="rows-section" aria-label="Decor icons">
      <p className="caption rows-caption">Icons on the sea turn white automatically.</p>
      <RowsHead columns={['', 'Icon', 'Size', 'Show on', '']} decor />
      <div className="rows">
        {data.decor.map((d) => (
          <div key={d.id} className="row row-decor" role="group" aria-label={ICONS[d.icon].name} data-key={d.id}>
            <VisibilityToggle visible={d.visible} onChange={(v) => onEdit(setVisible('decor', d.id, v))} />
            <IconPicker value={d.icon} onChange={(icon) => onEdit(setIcon('decor', d.id, icon))} />
            <label className="range-cell">
              <input
                type="range"
                className="range"
                aria-label="Size"
                min={DECOR_SIZE.min}
                max={DECOR_SIZE.max}
                step={SIZE_STEP}
                value={d.size}
                onChange={(e) => onEdit(setDecorSize(d.id, Number(e.target.value)))}
              />
              <span className="range-value">{d.size}</span>
            </label>
            <ShowOnButton showOn={d.showOn} onClick={() => onEdit(cycleShowOn('decor', d.id))} />
            <RemoveButton name={ICONS[d.icon].name} onClick={() => onEdit(remove('decor', d.id))} />
          </div>
        ))}
      </div>
      <div className="rows-foot">
        <button type="button" className="btn btn-outline" onClick={() => onEdit(addDecor(), 'Icon added — click it in the list to change the icon')}>
          + Add icon
        </button>
      </div>
    </section>
  );
}
