import { isOnLand } from '../shared/geo';
import { TAB_LABELS } from '../shared/ids';
import type { IslandEntry } from '../shared/islands';
import type { CanonicalHostel, Hostel } from '../shared/schema';
import { focusSoon } from './focus';
import { hostelAdded } from './placing';
import { POINT_COLUMNS, PointRow } from './PointRow';
import { PlaceButton, RowsHead, type OnEdit, type RowsProps } from './RowControls';
import { addHostel, markVerified, missingHostels } from './state';
import { usePopover } from './usePopover';

/* The Hostels list. Hostels are never invented (plan decision 3): there is no
   free "+ Add row" here, only the island's real hostels that are not on the
   map. "+ Add hostel" brings one back as its seed had it; "⌖ Click map to
   place" drops it where the map is clicked, with its seed label and label
   placement, unverified (the owner's choice, 2026-09-28). The badges carry
   decision 13: every coordinate is an approximation until the owner confirms
   the pin. */

export function HostelRows({ data, island, onEdit, placing }: RowsProps) {
  const missing = missingHostels(data, island);
  const armed = placing.armed?.kind === 'hostel';
  return (
    <section className="rows-section" aria-label={TAB_LABELS.hostels}>
      <RowsHead columns={POINT_COLUMNS} />
      <div className="rows">
        {data.hostels.map((h) => (
          <PointRow key={h.slug} kind="hostels" itemKey={h.slug} item={h} island={island} onEdit={onEdit} placing={placing}>
            <HostelBadges hostel={h} island={island} onEdit={onEdit} />
          </PointRow>
        ))}
      </div>
      <div className="rows-foot">
        <HostelPicker
          missing={missing}
          text={missing.length ? '+ Add hostel' : `All ${data.hostels.length} ${island.name} hostels are on the map`}
          listName="Hostels not on the map"
          onChoose={(h) => onEdit(addHostel(h.slug), hostelAdded(h.name))}
        />
        <HostelPicker
          missing={missing}
          listName="Hostels to place on the map"
          onChoose={(h) => placing.arm({ kind: 'hostel', slug: h.slug, name: h.name })}
          placing={{ armed, onCancel: placing.cancel }}
        />
      </div>
    </section>
  );
}

type HostelPickerProps = {
  missing: CanonicalHostel[];
  /** Names the list of hostels for screen readers. */
  listName: string;
  onChoose: (hostel: CanonicalHostel) => void;
  /** "+ Add hostel": a plain button with this text. */
  text?: string;
  /** "⌖ Click map to place": the place button, which cancels instead of opening the list while armed. */
  placing?: { armed: boolean; onCancel: () => void };
};

/* A button and a short list, not a <select>: on Windows a focused select
   changes value on the arrow keys without opening, and every change here
   adds or arms a hostel. The button stays the same element when nothing is
   left to choose (aria-disabled, not disabled), so the last choice keeps
   focus. */
function HostelPicker({ missing, listName, onChoose, text, placing }: HostelPickerProps) {
  const { open, root, panelId, triggerProps, choose } = usePopover();
  const armed = placing?.armed ?? false;
  const none = missing.length === 0 && !armed;
  const trigger = {
    ...triggerProps,
    // Armed, the button cancels: it no longer opens a list.
    'aria-expanded': armed ? undefined : triggerProps['aria-expanded'],
    'aria-disabled': none || undefined,
    onClick: armed ? placing?.onCancel : none ? undefined : triggerProps.onClick,
  };
  return (
    <div className="picker add-hostel" ref={root}>
      {placing ? (
        <PlaceButton armed={armed} {...trigger} />
      ) : (
        <button type="button" className="btn btn-outline" {...trigger}>
          {text}
        </button>
      )}
      {open && !none && !armed && (
        <div id={panelId} className="picker-panel picker-menu" role="group" aria-label={listName}>
          {missing.map((h, i) => (
            <button
              key={h.slug}
              type="button"
              autoFocus={i === 0}
              onClick={() => {
                onChoose(h);
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
