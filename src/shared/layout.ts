import { clusterHostels } from './cluster.js';
import { parsePolygons, pointInPolygons, project, type Point, type Polygon } from './geo.js';
import { ICONS } from './icons.js';
import { labelLook, labelWidth, pillMetrics, placeLabel, type Leader, type MarkerKind, type TextMeasurer } from './labels.js';
import type { Geometry, IslandData, Layer, LabelPlacement, ShowOn } from './schema.js';
import {
  BADGE,
  DECOR_STROKE,
  ICON_BOX,
  ON_DARK_ALPHA,
  PALETTES,
  RING_OPACITY,
  TEXT_BASELINE,
  TEXT_HALO,
  WHITE,
  type Palette,
} from './tokens.js';

/* Everything <IslandMap> draws, computed from one island file for one layer
   (handoff README §1), as plain primitives. The renderer only maps this to
   markup, so every rule of the artwork lives here or in labels.ts / cluster.ts
   and is testable without a DOM.

   Every number is rounded once, here: positions to 0.1 px, sizes and scales
   to 0.01. React prints raw floats (0.30000000000000004), and the SVG must be
   byte-for-byte deterministic for the snapshots and for readable diffs. */

const c1 = (n: number) => Math.round(n * 10) / 10;
const m2 = (n: number) => Math.round(n * 100) / 100;

export type RingShape = { id: string; d: string; opacity: number };
export type RouteShape = { id: string; d: string };
/** x, y: top-left of the 24-unit icon box after scaling, so the icon is centred on its point. */
export type DecorShape = { id: string; key: string; x: number; y: number; scale: number; strokeWidth: number; color: string; paths: readonly string[] };
export type MarkerShape =
  | { kind: Exclude<MarkerKind, 'badge'>; id: string; x: number; y: number; scale: number }
  | { kind: 'badge'; id: string; x: number; y: number; paths: readonly string[] };
/** x, y: the label centre. `rect` is the pill around it; `fill: null` draws no pill (text-only style). */
export type LabelShape = {
  id: string;
  key: string;
  x: number;
  y: number;
  text: string;
  rect: { x: number; y: number; w: number; h: number; r: number };
  fill: string | null;
  color: string;
};
/** Shared by every label of a map. `halo` is the white stroke width of the text-only style, 0 otherwise. */
export type LabelText = { family: string; weight: number; size: number; letterSpacing: number; x: number; y: number; halo: number };

export type MapLayout = {
  /** Prefix of the defs ids, so two maps inlined in one page don't share gradients. */
  prefix: string;
  palette: Palette;
  /** Outermost first. */
  rings: RingShape[];
  coast: string;
  routes: RouteShape[];
  decor: DecorShape[];
  /** Id of the marker group: `hostels` or `attractions`. */
  group: Layer;
  leaders: Leader[];
  /** Sorted by y, so lower markers sit on top. */
  markers: MarkerShape[];
  labels: LabelShape[];
  text: LabelText;
};

/** The badge's icon: 26 px inside the r 22 circle, centred. */
export const BADGE_ICON = { offset: -BADGE.iconSize / 2, scale: m2(BADGE.iconSize / ICON_BOX) } as const;

const polygonCache = new Map<string, Polygon[]>();
function polygons(d: string): Polygon[] {
  let p = polygonCache.get(d);
  if (!p) polygonCache.set(d, (p = parsePolygons(d)));
  return p;
}

const showsOn = (showOn: ShowOn, layer: Layer) => showOn === 'both' || showOn === layer;

/* Plan decision 5: decor turns white where the rings actually drawn behind it
   are dark enough. The composite alpha of the shown rings covering the point
   is 1 − Π(1 − opacity); ring-3 + ring-4 give 0.44, but only with all four
   rings shown. The epsilon absorbs 1 − 0.7·0.8 = 0.43999…. */
function decorColor(geometry: Geometry, shownRings: number, p: Point, ink: string): string {
  if (pointInPolygons(polygons(geometry.island), p.x, p.y)) return ink;
  let clear = 1;
  for (let i = 0; i < shownRings; i++) {
    if (pointInPolygons(polygons(geometry.rings[i]!.d), p.x, p.y)) clear *= 1 - RING_OPACITY[i]!;
  }
  return 1 - clear >= ON_DARK_ALPHA - 1e-9 ? WHITE : ink;
}

/** A point on the map: where its marker stands and how its label hangs off it. */
type Anchor = { key: string; label: string; placement: LabelPlacement; at: Point };

/** Things to do never cluster: one badge per visible attraction. */
function attractionPoints(data: IslandData, proj: Geometry['projection']): { markers: MarkerShape[]; anchors: Anchor[] } {
  const visible = data.attractions.filter((a) => a.visible);
  const at = visible.map((a) => project(proj, a.lat, a.lng));
  return {
    markers: visible.map((a, i) => ({ kind: 'badge', id: `spot-${a.id}`, ...at[i]!, paths: ICONS[a.icon].paths })),
    anchors: visible.map((a, i) => ({ key: a.id, label: a.label, placement: a.labelPlacement, at: at[i]! })),
  };
}

export function computeMapLayout(geometry: Geometry, data: IslandData, layer: Layer, measure: TextMeasurer): MapLayout {
  const s = data.settings;
  const palette = PALETTES[s.palette];
  const proj = geometry.projection;

  const rings = geometry.rings
    .slice(0, s.rings)
    .map((r, i) => ({ id: r.id, d: r.d, opacity: RING_OPACITY[i]! }))
    .reverse();

  const decor: DecorShape[] = !s.showIcons
    ? []
    : data.decor
        .filter((d) => d.visible && showsOn(d.showOn, layer))
        .map((d) => {
          const p = project(proj, d.lat, d.lng);
          const scale = d.size / ICON_BOX;
          return {
            id: `decor-${d.id}`,
            key: d.id,
            x: c1(p.x - d.size / 2),
            y: c1(p.y - d.size / 2),
            scale: m2(scale),
            strokeWidth: m2(DECOR_STROKE / scale),
            color: decorColor(geometry, s.rings, p, palette.ink),
            paths: ICONS[d.icon].paths,
          };
        });

  // Hostels share a pin when they are close; routes and labels hang off that pin.
  const clusters = clusterHostels(data.hostels, proj);
  const pinOf = new Map(clusters.flatMap((c) => c.members.map((m) => [m.hostel.slug, c] as const)));

  const routes: RouteShape[] = !s.showIcons
    ? []
    : data.routes.flatMap((r) => {
        const from = pinOf.get(r.from);
        const to = pinOf.get(r.to);
        if (!r.visible || !showsOn(r.showOn, layer) || !from || !to || from === to) return [];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        // Control point: the midpoint pushed along the normal (−dy, dx)/len by bend·len/2.
        const k = (r.bend * len) / 2;
        const cx = (from.x + to.x) / 2 - (dy / len) * k;
        const cy = (from.y + to.y) / 2 + (dx / len) * k;
        return [{ id: `route-${r.id}`, d: `M${c1(from.x)} ${c1(from.y)}Q${c1(cx)} ${c1(cy)} ${c1(to.x)} ${c1(to.y)}` }];
      });

  const kind: MarkerKind = layer === 'hostels' ? s.pinStyle : 'badge';
  const points =
    layer === 'hostels'
      ? {
          markers: clusters.map((c): MarkerShape => ({ kind: s.pinStyle, id: `pin-${c.id}`, x: c.x, y: c.y, scale: m2(s.pinSize) })),
          anchors: data.hostels.flatMap((h): Anchor[] => {
            const pin = pinOf.get(h.slug);
            return pin ? [{ key: h.slug, label: h.label, placement: h.labelPlacement, at: pin }] : [];
          }),
        }
      : attractionPoints(data, proj);
  // Stable sort on the exact y, then round: lower markers are drawn last, on top.
  const markers = [...points.markers].sort((a, b) => a.y - b.y).map((m) => ({ ...m, x: c1(m.x), y: c1(m.y) }));
  const anchors = points.anchors;

  const metrics = pillMetrics(s);
  const look = labelLook(s.labelStyle, layer, palette);
  const leaders: Leader[] = [];
  const labels: LabelShape[] = anchors.map((a) => {
    // Stored as typed, uppercased here: the SVG itself carries the capitals.
    const text = a.label.toUpperCase();
    // Round the half sizes, so the pill stays centred and its corner keeps 2 decimals too.
    const halfW = m2(labelWidth(text, metrics, measure) / 2);
    const halfH = m2(metrics.h / 2);
    const [w, h] = [2 * halfW, 2 * halfH];
    const { dx, dy, side } = a.placement;
    const placed = placeLabel({ kind, side, dx, dy, at: a.at, pinSize: s.pinSize, w, h });
    if (placed.leader) {
      const l = placed.leader;
      leaders.push({ x1: c1(l.x1), y1: c1(l.y1), x2: c1(l.x2), y2: c1(l.y2) });
    }
    return {
      id: `label-${a.key}`,
      key: a.key,
      x: c1(placed.x),
      y: c1(placed.y),
      text,
      rect: { x: -halfW, y: -halfH, w, h, r: m2(metrics.r) },
      fill: look.fill,
      color: look.color,
    };
  });

  return {
    prefix: `${data.island}-${layer}`,
    palette,
    rings,
    coast: geometry.island,
    routes,
    decor,
    group: layer,
    leaders,
    markers,
    labels,
    text: {
      family: metrics.font.family,
      weight: metrics.font.weight,
      size: m2(metrics.fs),
      letterSpacing: m2(metrics.ls),
      x: c1(metrics.ls / 2),
      y: c1(metrics.fs * TEXT_BASELINE),
      halo: look.halo ? m2(metrics.fs * TEXT_HALO) : 0,
    },
  };
}
