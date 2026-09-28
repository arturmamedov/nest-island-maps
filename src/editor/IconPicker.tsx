import { ICON_IDS, ICONS, type IconId } from '../shared/icons';
import { usePopover } from './usePopover';

/* The icon choice for a thing to do or a decor icon. The prototype cycled
   through the set one click at a time; the spec (§2) asks for a dropdown in
   the real app, so the button opens every icon at once, with its preview and
   name. */

/** An icon from the set, drawn for the editor chrome in the current text colour. */
export function IconGlyph({ icon, size = 16 }: { icon: IconId; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[icon].paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function IconPicker({ value, onChange }: { value: IconId; onChange: (icon: IconId) => void }) {
  const { open, root, panelId, triggerProps, choose } = usePopover();
  return (
    <div className="picker" ref={root}>
      <button type="button" className="icon-button" aria-label={`Icon: ${ICONS[value].name}`} title="Click to change icon" {...triggerProps}>
        <IconGlyph icon={value} />
        <span className="icon-name">{ICONS[value].name}</span>
        <span className="icon-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div id={panelId} className="picker-panel picker-grid" role="group" aria-label="Icons">
          {ICON_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === value}
              autoFocus={id === value}
              onClick={() => {
                onChange(id);
                choose();
              }}
            >
              <IconGlyph icon={id} size={20} />
              <span>{ICONS[id].name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
