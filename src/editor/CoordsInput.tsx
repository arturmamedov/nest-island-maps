import { formatCoords, parseCoords } from '../shared/coords';
import type { ProjectionConstants } from '../shared/geo';
import { useRawText } from './useRawText';

/* The "Lat, lng" input (spec §2, plan decision 13). It takes a Google Maps
   paste ("28.04700, -16.53550", or ";" or a space between), refuses Maps
   links and points off the artboard, and turns #D15653 while the text doesn't
   parse. The raw text lives here; the data holds numbers only, changed when
   the text parses to a new point. */

type LatLng = { lat: number; lng: number };

const format = (p: LatLng) => formatCoords(p.lat, p.lng);
const same = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng;

type CoordsInputProps = LatLng & { projection: ProjectionConstants; onCommit: (at: LatLng) => void };

export function CoordsInput({ lat, lng, projection, onCommit }: CoordsInputProps) {
  const [text, setText] = useRawText({ lat, lng }, format, same);
  const check = parseCoords(text, projection);
  return (
    <input
      className="input input-coords"
      aria-label="Lat, lng"
      placeholder="28.0470, -16.5355"
      spellCheck={false}
      value={text}
      aria-invalid={!check.ok}
      title={check.ok ? undefined : check.error}
      onChange={(e) => {
        const next = e.target.value;
        const r = parseCoords(next, projection);
        const at = r.ok ? { lat: r.lat, lng: r.lng } : undefined;
        setText(next, at && { value: at });
        if (at && !same(at, { lat, lng })) onCommit(at);
      }}
    />
  );
}
