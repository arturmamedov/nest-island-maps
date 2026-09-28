import { isOnLand } from '../shared/geo';
import { TAB_LABELS } from '../shared/ids';
import type { IslandEntry } from '../shared/islands';
import type { Hostel, IslandData } from '../shared/schema';
import { focusSoon } from './focus';
import { POINT_COLUMNS, PointRow } from './PointRow';
import { RowsHead, type OnEdit, type RowsProps } from './RowControls';
import { addHostel, markVerified, missingHostels } from './state';
import { usePopover } from './usePopover';

/* The Hostels list. Hostels are never invented (plan decision 3): there is no
   free "+ Add row" here, only the island's real hostels that are not on the
   map, each coming back as its seed had it. The badges carry decision 13:
   every coordinate is an approximation until the owner confirms the pin. */

export function HostelRows({ data, island, onEdit }: RowsProps) {
  return (
    <section className="rows-section" aria-label={TAB_LABELS.hostels}>
      <RowsHead columns={POINT_COLUMNS} />
      <div className="rows">
        {data.hostels.map((h) => (
          <PointRow key={h.slug} kind="hostels" itemKey={h.slug} item={h} island={island} onEdit={onEdit}>
            <HostelBadges hostel={h} island={island} onEdit={onEdit} />
          </PointRow>
        ))}
      </div>
      <div className="rows-foot">
        <AddHostel data={data} island={island} onEdit={onEdit} />
      </div>
    </section>
  );
}

/* A button and a short list, not a <select>: on Windows a focused select
   changes value on the arrow keys without opening, and every change here
   adds a hostel. The button stays the same element when nothing is left to
   add (aria-disabled, not disabled), so adding the last hostel keeps focus. */
function AddHostel({ data, island, onEdit }: { data: IslandData; island: IslandEntry; onEdit: OnEdit }) {
  const missing = missingHostels(data, island);
  const { open, root, panelId, triggerProps, choose } = usePopover();
  const none = missing.length === 0;
  return (
    <div className="picker add-hostel" ref={root}>
      <button type="button" className="btn btn-outline" {...triggerProps} aria-disabled={none || undefined} onClick={none ? undefined : triggerProps.onClick}>
        {none ? `All ${data.hostels.length} ${island.name} hostels are on the map` : '+ Add hostel'}
      </button>
      {open && !none && (
        <div id={panelId} className="picker-panel picker-menu" role="group" aria-label="Hostels not on the map">
          {missing.map((h, i) => (
            <button
              key={h.slug}
              type="button"
              autoFocus={i === 0}
              onClick={() => {
                onEdit(addHostel(h.slug), `${h.name} added`);
                choose();
              }}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HostelBadges({ hostel: h, island, onEdit }: { hostel: Hostel; island: IslandEntry; onEdit: OnEdit }) {
  const inSea = !isOnLand(island.geometry, h.lat, h.lng);
  if (h.coordsVerified && !inSea) return null;
  return (
    <div className="badges">
      {!h.coordsVerified && (
        <button
          type="button"
          className="badge"
          aria-label="Unverified: mark as verified"
          title="Approximate pin. Click once it matches the hostel’s real map pin."
          onClick={(e) => {
            // The badge goes once verified; focus moves to the row's name.
            const name = e.currentTarget.closest('.row')?.querySelector('input');
            onEdit(markVerified(h.slug), `${h.label} marked verified`);
            focusSoon(() => name);
          }}
        >
          Unverified
        </button>
      )}
      {inSea && (
        <span className="badge badge-sea" title="This pin lands in the sea: check its coordinates">
          In the sea
        </span>
      )}
    </div>
  );
}
