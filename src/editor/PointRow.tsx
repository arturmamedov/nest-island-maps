import type { ReactNode } from 'react';
import type { IslandEntry } from '../shared/islands';
import type { Attraction, Hostel } from '../shared/schema';
import { CoordsInput } from './CoordsInput';
import { CANCEL_PLACING } from './placing';
import { LabelInput, RemoveButton, SideButtons, VisibilityToggle, type OnEdit } from './RowControls';
import { remove, setCoords, setLabel, setSide, setVisible, type PointKind } from './state';
import type { Placing } from './usePlacing';

/* One hostel or thing-to-do row, in the prototype's grid: visibility, name
   (with the row kind's extras under it), "Lat, lng" with "⌖ Place on map"
   under it, label side, ×. Placing moves the row's point to the next click
   on the map (the owner's choice, 2026-09-28): a hostel moved that way is
   unverified again, and its "Lat, lng" text follows (useRawText). */

export const POINT_COLUMNS = ['', 'Name', 'Lat, lng', 'Label', ''] as const;

type PointRowProps = {
  kind: PointKind;
  /** The hostel slug or the attraction id. */
  itemKey: string;
  item: Hostel | Attraction;
  island: IslandEntry;
  onEdit: OnEdit;
  placing: Placing;
  fresh?: boolean;
  /** Under the name: the hostel badges, or the icon picker. */
  children?: ReactNode;
};

export function PointRow({ kind, itemKey, item, island, onEdit, placing, fresh, children }: PointRowProps) {
  const armed = placing.armed;
  const moving = armed?.kind === 'move' && armed.collection === kind && armed.key === itemKey;
  return (
    <div className="row" role="group" aria-label={item.label} data-key={itemKey}>
      <VisibilityToggle visible={item.visible} onChange={(v) => onEdit(setVisible(kind, itemKey, v))} />
      <div className="row-name">
        <LabelInput value={item.label} island={island.id} fresh={fresh} onCommit={(text) => onEdit(setLabel(kind, itemKey, text))} />
        {children}
      </div>
      <div className="row-coords">
        <CoordsInput lat={item.lat} lng={item.lng} projection={island.geometry.projection} onCommit={(at) => onEdit(setCoords(kind, itemKey, at))} />
        <button
          type="button"
          className={moving ? 'place-point armed' : 'place-point'}
          title={moving ? undefined : 'Then click the map where it stands'}
          onClick={() => (moving ? placing.cancel() : placing.arm({ kind: 'move', collection: kind, key: itemKey, label: item.label }))}
        >
          {moving ? CANCEL_PLACING : '⌖ Place on map'}
        </button>
      </div>
      <SideButtons side={item.labelPlacement.side} onChange={(side) => onEdit(setSide(kind, itemKey, side))} />
      <RemoveButton name={item.label} onClick={() => onEdit(remove(kind, itemKey))} />
    </div>
  );
}
