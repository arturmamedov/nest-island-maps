import { LABEL_STYLES, PIN_STYLES, type Settings } from '../shared/schema';
import { LABEL_FONT_IDS, LABEL_FONTS, LABEL_SIZE, LABEL_TRACKING, PALETTE_IDS, PIN_SIZE, RING_COUNT } from '../shared/tokens';
import { PREVIEW_BACKGROUND_LABELS, type PreviewBackground } from './prefs';

/* The prototype's Tweaks (spec §2 "Settings"), grouped as the prototype
   grouped them. The nine map settings belong to the island file and are
   shared by its two maps (a plan decision), so they save and export with it.
   The preview background sits among them but is not a setting: it is this
   browser's preference and never reaches a file (prefs.ts). Ranges come from
   tokens.ts, the same numbers the schema enforces. */

type Option<V> = { value: V; label: string };
type ChoiceKey = 'palette' | 'labelFont' | 'labelStyle' | 'pinStyle' | 'rings';
type RangeKey = 'labelSize' | 'labelTracking' | 'pinSize';
type Patch = Partial<Settings>;

type Field =
  | { kind: 'choice'; key: ChoiceKey; label: string; options: readonly Option<Settings[ChoiceKey]>[]; asSelect?: boolean }
  | { kind: 'range'; key: RangeKey; label: string; min: number; max: number; step: number; show: (v: number) => string }
  | { kind: 'toggle'; key: 'showIcons'; label: string }
  | { kind: 'preview'; key: 'preview'; label: string };

const PALETTE_LABELS: Record<Settings['palette'], string> = { original: 'Original', brandTeal: 'Brand teal' };
const STYLE_LABELS: Record<Settings['labelStyle'], string> = { accent: 'Accent pill', white: 'White pill', dark: 'Dark pill', text: 'Text only' };
const PIN_LABELS: Record<Settings['pinStyle'], string> = { pin: 'Pin', dot: 'Dot' };

const options = <V extends string | number>(values: readonly V[], label: (v: V) => string): Option<V>[] => values.map((value) => ({ value, label: label(value) }));
const RING_CHOICES = Array.from({ length: RING_COUNT + 1 }, (_, n) => n);

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: 'Colours',
    fields: [
      { kind: 'choice', key: 'palette', label: 'Palette', options: options(PALETTE_IDS, (p) => PALETTE_LABELS[p]) },
      { kind: 'preview', key: 'preview', label: 'Preview' },
    ],
  },
  {
    title: 'Labels',
    fields: [
      { kind: 'choice', key: 'labelFont', label: 'Font', options: options(LABEL_FONT_IDS, (f) => LABEL_FONTS[f].family), asSelect: true },
      { kind: 'range', key: 'labelSize', label: 'Size', ...LABEL_SIZE, step: 1, show: (v) => `${v}px` },
      { kind: 'range', key: 'labelTracking', label: 'Tracking', ...LABEL_TRACKING, step: 0.01, show: (v) => `${v.toFixed(2)}em` },
      { kind: 'choice', key: 'labelStyle', label: 'Style', options: options(LABEL_STYLES, (s) => STYLE_LABELS[s]) },
    ],
  },
  {
    title: 'Markers',
    fields: [
      { kind: 'choice', key: 'pinStyle', label: 'Pin style', options: options(PIN_STYLES, (p) => PIN_LABELS[p]) },
      { kind: 'range', key: 'pinSize', label: 'Pin size', ...PIN_SIZE, step: 0.05, show: (v) => v.toFixed(2) },
    ],
  },
  {
    title: 'Island',
    fields: [
      { kind: 'choice', key: 'rings', label: 'Rings', options: options(RING_CHOICES, String) },
      { kind: 'toggle', key: 'showIcons', label: 'Decor icons and routes' },
    ],
  },
];

type SettingsPanelProps = {
  settings: Settings;
  islandName: string;
  onChange: (patch: Patch) => void;
  background: PreviewBackground;
  onBackground: (background: PreviewBackground) => void;
};

export function SettingsPanel({ islandName, ...props }: SettingsPanelProps) {
  return (
    <section className="panel-section" aria-labelledby="settings-title">
      <h2 id="settings-title" className="panel-title">
        Settings
      </h2>
      <p className="caption settings-caption">Both {islandName} maps share these.</p>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <h3 className="settings-group-title">{g.title}</h3>
          {g.fields.map((f) => (
            <SettingField key={f.key} field={f} {...props} />
          ))}
        </div>
      ))}
    </section>
  );
}

function SettingField({ field: f, settings, onChange, background, onBackground }: Omit<SettingsPanelProps, 'islandName'> & { field: Field }) {
  switch (f.kind) {
    case 'range': {
      const v = settings[f.key];
      // Named by its label alone; the shown value ("25px") is the slider's value text, not part of its name.
      return (
        <div className="field">
          <span className="field-label" id={`setting-${f.key}`}>
            {f.label}
          </span>
          <input
            type="range"
            className="range"
            aria-labelledby={`setting-${f.key}`}
            aria-valuetext={f.show(v)}
            min={f.min}
            max={f.max}
            step={f.step}
            value={v}
            onChange={(e) => onChange({ [f.key]: Number(e.target.value) } as Patch)}
          />
          <span className="field-note" aria-hidden="true">
            {f.show(v)}
          </span>
        </div>
      );
    }
    case 'toggle':
      return (
        <label className="field field-toggle">
          <input type="checkbox" checked={settings[f.key]} onChange={(e) => onChange({ [f.key]: e.target.checked })} />
          <span>{f.label}</span>
        </label>
      );
    case 'preview':
      return (
        <div className="field">
          <span className="field-label">{f.label}</span>
          <div className="chips" role="group" aria-label="Preview background">
            {(Object.keys(PREVIEW_BACKGROUND_LABELS) as PreviewBackground[]).map((b) => (
              <button key={b} type="button" className="chip" aria-pressed={b === background} onClick={() => onBackground(b)}>
                {PREVIEW_BACKGROUND_LABELS[b]}
              </button>
            ))}
          </div>
          <span className="field-note">never exported</span>
        </div>
      );
    case 'choice': {
      const current = settings[f.key];
      const choose = (value: Settings[ChoiceKey]) => onChange({ [f.key]: value } as Patch);
      if (f.asSelect) {
        return (
          <label className="field">
            <span className="field-label">{f.label}</span>
            <select className="select" value={String(current)} onChange={(e) => choose(f.options.find((o) => String(o.value) === e.target.value)!.value)}>
              {f.options.map((o) => (
                <option key={o.value} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        );
      }
      // Pressed buttons in a named group, like the preview chips: each is a plain button in the tab order.
      return (
        <div className="field">
          <span className="field-label" id={`setting-${f.key}`}>
            {f.label}
          </span>
          <div className="segmented segmented-small" role="group" aria-labelledby={`setting-${f.key}`}>
            {f.options.map((o) => (
              <button key={o.value} type="button" aria-pressed={o.value === current} onClick={() => choose(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
  }
}
