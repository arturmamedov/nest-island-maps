import type { PointerEvent } from 'react';
import type { TextMeasurer } from '../shared/labels';
import { BADGE_ICON, computeMapLayout, type DecorShape, type LabelShape, type LabelText, type MarkerShape } from '../shared/layout';
import type { Geometry, IslandData, Layer } from '../shared/schema';
import { ARTBOARD, ATTRIBUTION, BADGE, COAST_STROKE, DOT, GRADIENT, ICON_BOX, LEADER, PIN_PATH, ROUTE, SHADOW, WHITE } from '../shared/tokens';
import { canvasMeasurer } from './measure';

/* THE renderer (handoff README §1): the editor preview, the SVG export and
   the PNG/JPG export all draw through this component, so what staff see is
   what ships. It is a pure function of its props: no effects, no useId, no
   DOM reads beyond the injected measurer, so renderToStaticMarkup gives the
   export file directly (src/export/svg.ts).

   Markup rules, all for Figma and Illustrator, which import the SVG:
   - presentation attributes, never style objects;
   - element ids are the layer names designers see (halo-rings, island,
     decor, hostels/attractions, attribution, pin-*, label-*…);
   - every path inline, no <use> or <symbol>;
   - font-family unquoted, since React would escape the quotes.
   Edit mode is the `interaction` prop and adds only transparent data-hit
   rects and cursor styles; a test holds the rest of the markup identical. */

export type LabelTarget = { layer: Layer; key: string };

export type MapInteraction = {
  /** Pointer down on a label; `key` is the hostel slug or the attraction id. */
  onLabelPointerDown?: (e: PointerEvent<SVGGElement>, target: LabelTarget) => void;
  /** Pointer down on a decor icon; `key` is the decor id. */
  onDecorPointerDown?: (e: PointerEvent<SVGGElement>, key: string) => void;
};

export type IslandMapProps = {
  geometry: Geometry;
  data: IslandData;
  layer: Layer;
  /** Label text measurer; the canvas one in the browser, a stub in Node tests. */
  measure?: TextMeasurer;
  /** Present only in the editor. */
  interaction?: MapInteraction;
};

const family = (name: string) => `${name}, sans-serif`;

export function IslandMap({ geometry, data, layer, measure = canvasMeasurer, interaction }: IslandMapProps) {
  const map = computeMapLayout(geometry, data, layer, measure);
  const defId = (name: 'halo' | 'land' | 'shadow') => `${map.prefix}-${name}`;
  const url = (name: 'halo' | 'land' | 'shadow') => `url(#${defId(name)})`;
  const shadow = url('shadow');
  const ink = map.palette.ink;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${ARTBOARD} ${ARTBOARD}`} width={ARTBOARD} height={ARTBOARD}>
      <defs>
        <linearGradient id={defId('halo')} {...GRADIENT.halo}>
          <stop offset="0" stopColor={map.palette.halo[0]} />
          <stop offset="1" stopColor={map.palette.halo[1]} />
        </linearGradient>
        <linearGradient id={defId('land')} {...GRADIENT.land}>
          <stop offset="0" stopColor={map.palette.land[0]} />
          <stop offset="1" stopColor={map.palette.land[1]} />
        </linearGradient>
        <filter id={defId('shadow')} {...SHADOW.region}>
          <feMorphology operator="dilate" radius={SHADOW.dilate} in="SourceAlpha" result="spread" />
          <feGaussianBlur in="spread" stdDeviation={SHADOW.blur} result="blur" />
          <feFlood floodColor={SHADOW.color} floodOpacity={SHADOW.opacity} />
          <feComposite in2="blur" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g id="halo-rings">
        {map.rings.map((r) => (
          <path key={r.id} id={r.id} d={r.d} fill={url('halo')} fillOpacity={r.opacity} />
        ))}
      </g>

      <path id="island" d={map.coast} fill={url('land')} stroke={WHITE} strokeWidth={COAST_STROKE} strokeLinejoin="round" />

      {(map.routes.length > 0 || map.decor.length > 0) && (
        <g id="decor">
          {map.routes.map((r) => (
            <path
              key={r.id}
              id={r.id}
              d={r.d}
              fill="none"
              stroke={WHITE}
              strokeWidth={ROUTE.width}
              strokeDasharray={ROUTE.dash}
              strokeLinecap="round"
              opacity={ROUTE.opacity}
            />
          ))}
          {map.decor.map((d) => (
            <DecorIcon key={d.id} decor={d} interaction={interaction} />
          ))}
        </g>
      )}

      <g id={map.group}>
        {map.leaders.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={WHITE} strokeWidth={LEADER.width} strokeLinecap="round" />
        ))}
        {map.markers.map((m) => (
          <Marker key={m.id} marker={m} ink={ink} shadow={shadow} />
        ))}
        {map.labels.map((l) => (
          <Label key={l.id} label={l} text={map.text} shadow={shadow} layer={layer} interaction={interaction} />
        ))}
      </g>

      <text
        id="attribution"
        x={ATTRIBUTION.x}
        y={ATTRIBUTION.y}
        textAnchor="end"
        fontFamily={family(ATTRIBUTION.family)}
        fontWeight={ATTRIBUTION.weight}
        fontSize={ATTRIBUTION.size}
        fill={ink}
        opacity={ATTRIBUTION.opacity}
      >
        {ATTRIBUTION.text}
      </text>
    </svg>
  );
}

function DecorIcon({ decor: d, interaction }: { decor: DecorShape; interaction?: MapInteraction }) {
  return (
    <g
      id={d.id}
      transform={`translate(${d.x} ${d.y}) scale(${d.scale})`}
      fill="none"
      stroke={d.color}
      strokeWidth={d.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={interaction ? { cursor: 'move' } : undefined}
      onPointerDown={interaction && ((e) => interaction.onDecorPointerDown?.(e, d.key))}
    >
      {interaction && <rect data-hit="1" x={0} y={0} width={ICON_BOX} height={ICON_BOX} fill="transparent" stroke="none" />}
      {d.paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </g>
  );
}

function Marker({ marker: m, ink, shadow }: { marker: MarkerShape; ink: string; shadow: string }) {
  if (m.kind === 'badge') {
    // No shadow on attraction badges, as in the prototype.
    return (
      <g id={m.id} transform={`translate(${m.x} ${m.y})`}>
        <circle r={BADGE.r} fill={ink} stroke={WHITE} strokeWidth={BADGE.stroke} />
        <g
          transform={`translate(${BADGE_ICON.offset} ${BADGE_ICON.offset}) scale(${BADGE_ICON.scale})`}
          fill="none"
          stroke={WHITE}
          strokeWidth={BADGE.iconStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {m.paths.map((p, i) => (
            <path key={i} d={p} />
          ))}
        </g>
      </g>
    );
  }
  return (
    <g id={m.id} transform={`translate(${m.x} ${m.y}) scale(${m.scale})`} filter={shadow}>
      {m.kind === 'pin' ? (
        // Even-odd leaves the hole transparent: it shows the land or the ring underneath.
        <path d={PIN_PATH} fill={WHITE} fillRule="evenodd" />
      ) : (
        <>
          <circle r={DOT.outerR} fill={WHITE} />
          <circle r={DOT.innerR} fill={ink} />
        </>
      )}
    </g>
  );
}

type LabelProps = { label: LabelShape; text: LabelText; shadow: string; layer: Layer; interaction?: MapInteraction };

function Label({ label: l, text: t, shadow, layer, interaction }: LabelProps) {
  const halo = t.halo > 0 ? { stroke: WHITE, strokeWidth: t.halo, strokeLinejoin: 'round' as const, paintOrder: 'stroke' } : {};
  return (
    <g
      id={l.id}
      transform={`translate(${l.x} ${l.y})`}
      style={interaction ? { cursor: 'grab' } : undefined}
      onPointerDown={interaction && ((e) => interaction.onLabelPointerDown?.(e, { layer, key: l.key }))}
    >
      {l.fill !== null && <rect x={l.rect.x} y={l.rect.y} width={l.rect.w} height={l.rect.h} rx={l.rect.r} fill={l.fill} filter={shadow} />}
      {/* x = ls/2 offsets the trailing tracking; the baseline y centres the capitals (Figma ignores dominant-baseline). */}
      <text
        x={t.x}
        y={t.y}
        textAnchor="middle"
        fontFamily={family(t.family)}
        fontWeight={t.weight}
        fontSize={t.size}
        letterSpacing={t.letterSpacing}
        fill={l.color}
        {...halo}
      >
        {l.text}
      </text>
      {interaction && <rect data-hit="1" x={l.rect.x} y={l.rect.y} width={l.rect.w} height={l.rect.h} fill="transparent" />}
    </g>
  );
}
