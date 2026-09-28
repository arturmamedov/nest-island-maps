import type { ReactNode } from 'react';
import type { IslandEntry } from '../shared/islands';
import type { Attraction, Hostel } from '../shared/schema';
import { CoordsInput } from './CoordsInput';
import { LabelInput, RemoveButton, SideButtons, VisibilityToggle, type OnEdit } from './RowControls';
import { remove, setCoords, setLabel, setSide, setVisible, type PointKind } from './state';

/* One hostel or thing-to-do row, in the prototype's grid: visibility, name
   (with the row kind's extras under it), "Lat, lng", label side, ×. */

export const POINT_COLUMNS = ['', 'Name', 'Lat, lng', 'Label', ''] as const;

type PointRowProps = {
  kind: PointKind;
  /** The hostel slug or the attraction id. */
  itemKey: string;
  item: Hostel | Attraction;
  island: IslandEntry;
  onEdit: OnEdit;
  fresh?: boolean;
  /** Under the name: the hostel badges, or the icon picker. */
  children?: ReactNode;
};

export function PointRow({ kind, itemKey, item, island, onEdit, fresh, children }: PointRowProps) {
  return (
    <div className="row" role="group" aria-label={item.label} data-key={itemKey}>
      <VisibilityToggle visible={item.visible} onChange={(v) => onEdit(setVisible(kind, itemKey, v))} />
      <div className="row-name">
        <LabelInput value={item.label} island={island.id} fresh={fresh} onCommit={(text) => onEdit(setLabel(kind, itemKey, text))} />
        {children}
      </div>
      <CoordsInput lat={item.lat} lng={item.lng} projection={island.geometry.projection} onCommit={(at) => onEdit(setCoords(kind, itemKey, at))} />
      <SideButtons side={item.labelPlacement.side} onChange={(side) => onEdit(setSide(kind, itemKey, side))} />
      <RemoveButton name={item.label} onClick={() => onEdit(remove(kind, itemKey))} />
    </div>
  );
}
