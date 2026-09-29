import { describe, expect, it } from 'vitest';
import { project } from '../../src/shared/geo.js';
import { ISLANDS } from '../../src/shared/islands.js';
import type { TextMeasurer } from '../../src/shared/labels.js';
import { computeMapLayout, type MapLayout } from '../../src/shared/layout.js';
import { ISLAND_IDS, LAYERS, type IslandData, type IslandId, type Settings } from '../../src/shared/schema.js';
import { LABEL_BOX, PALETTES, WHITE } from '../../src/shared/tokens.js';

/* computeMapLayout turns one island file into the primitives <IslandMap>
   draws, already rounded. These tests pin the rules of handoff README §1
   and plan decision 5 (decor colour) against the real seeds. */

const stub: TextMeasurer = (text, { size }) => [...text].length * size * 0.55;

const withSettings = (data: IslandData, patch: Partial<Settings>): IslandData => ({ ...data, settings: { ...data.settings, ...patch } });

const layoutOf = (id: IslandId, layer: 'hostels' | 'attractions', patch: Partial<Settings> = {}, edit: (d: IslandData) => IslandData = (d) => d) =>
  computeMapLayout(ISLANDS[id].geometry, edit(withSettings(ISLANDS[id].seed, patch)), layer, stub);

describe('rings', () => {
  it('shows only the innermost n rings, outermost first, at the stacked opacities', () => {
    const expected = [
      [],
      [['ring-1', 1]],
      [['ring-2', 0.5], ['ring-1', 1]],
      [['ring-3', 0.3], ['ring-2', 0.5], ['ring-1', 1]],
      [['ring-4', 0.2], ['ring-3', 0.3], ['ring-2', 0.5], ['ring-1', 1]],
    ];
    for (let n = 0; n <= 4; n++) {
      const { rings } = layoutOf('tenerife', 'hostels', { rings: n });
      expect(rings.map((r) => [r.id, r.opacity])).toEqual(expected[n]);
    }
  });

  it('passes the geometry paths through unchanged', () => {
    const { rings, coast } = layoutOf('ibiza', 'hostels');
    const geo = ISLANDS.ibiza.geometry;
    expect(coast).toBe(geo.island);
    expect(rings.map((r) => r.d)).toEqual([...geo.rings].reverse().map((r) => r.d));
  });
});

describe('decor colour', () => {
  /* The decor that turns white at each ring count; every other icon is ink.
     White needs the composite alpha of the shown rings under the icon to
     reach 0.44: ring-3 + ring-4 (1 − 0.7·0.8) only counts with all 4 shown. */
  const WHITE_AT: Record<IslandId, string[][]> = {
    tenerife: [[], [], [], [], ['waves', 'boat']],
    gran_canaria: [[], [], ['waves'], ['waves'], ['fish', 'boat', 'waves']],
    ibiza: [[], [], [], [], ['boat']],
  };
  for (const id of ISLAND_IDS) {
    for (let n = 0; n <= 4; n++) {
      it(`${id}, ${n} rings`, () => {
        const { decor } = layoutOf(id, 'hostels', { rings: n });
        const ink = PALETTES.original.ink;
        expect(decor).toHaveLength(ISLANDS[id].seed.decor.length);
        for (const d of decor) expect([ink, WHITE]).toContain(d.color);
        expect(decor.filter((d) => d.color === WHITE).map((d) => d.key)).toEqual(WHITE_AT[id][n]);
      });
    }
  }

  it("Tenerife's boat and waves: white at 4 rings, ink at 3", () => {
    const colour = (n: number, key: string) => layoutOf('tenerife', 'hostels', { rings: n }).decor.find((d) => d.key === key)!.color;
    expect(colour(4, 'boat')).toBe(WHITE);
    expect(colour(4, 'waves')).toBe(WHITE);
    expect(colour(3, 'boat')).toBe(PALETTES.original.ink);
    expect(colour(3, 'waves')).toBe(PALETTES.original.ink);
  });

  it('uses the palette ink', () => {
    const { decor } = layoutOf('tenerife', 'hostels', { palette: 'brandTeal' });
    expect(decor.find((d) => d.key === 'teide')!.color).toBe(PALETTES.brandTeal.ink);
  });
});

describe('decor placement', () => {
  it('centres the 24-unit icon box on the point and keeps strokes 2.6 px on screen', () => {
    const { decor } = layoutOf('tenerife', 'hostels');
    const seed = ISLANDS.tenerife.seed.decor.find((d) => d.id === 'teide')!;
    const p = project(ISLANDS.tenerife.geometry.projection, seed.lat, seed.lng);
    const teide = decor.find((d) => d.key === 'teide')!;
    expect(teide.id).toBe('decor-teide');
    expect(teide.x).toBeCloseTo(p.x - 44, 1);
    expect(teide.y).toBeCloseTo(p.y - 44, 1);
    expect(teide.scale).toBe(3.67);
    expect(teide.strokeWidth).toBe(0.71);
    expect(teide.paths.length).toBeGreaterThan(0);
  });
});

describe('showOn and showIcons', () => {
  it('the attractions map drops decor meant for the hostels map', () => {
    expect(layoutOf('tenerife', 'attractions').decor.map((d) => d.key)).toEqual(['sun', 'bird', 'fish', 'waves', 'boat']);
    expect(layoutOf('tenerife', 'hostels').decor.map((d) => d.key)).toEqual(ISLANDS.tenerife.seed.decor.map((d) => d.id));
  });

  it('drops hidden decor', () => {
    const { decor } = layoutOf('tenerife', 'hostels', {}, (d) => ({ ...d, decor: d.decor.map((x) => (x.id === 'sun' ? { ...x, visible: false } : x)) }));
    expect(decor.map((d) => d.key)).not.toContain('sun');
  });

  it('showIcons off removes decor and routes', () => {
    const l = layoutOf('tenerife', 'hostels', { showIcons: false });
    expect(l.decor).toEqual([]);
    expect(l.routes).toEqual([]);
  });

  it('a route shows only on the map its showOn names', () => {
    expect(layoutOf('tenerife', 'hostels').routes.map((r) => r.id)).toEqual(['route-puerto-arena']);
    expect(layoutOf('tenerife', 'attractions').routes).toEqual([]);
    const both = layoutOf('tenerife', 'attractions', {}, (d) => ({ ...d, routes: d.routes.map((r) => ({ ...r, showOn: 'both' as const })) }));
    expect(both.routes.map((r) => r.id)).toEqual(['route-puerto-arena']);
  });
});

describe('routes', () => {
  const nums = (d: string) => {
    const m = d.match(/^M(-?[\d.]+) (-?[\d.]+)Q(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)$/);
    expect(m, d).not.toBeNull();
    const [ax, ay, cx, cy, bx, by] = m!.slice(1).map(Number) as [number, number, number, number, number, number];
    return { a: { x: ax, y: ay }, c: { x: cx, y: cy }, b: { x: bx, y: by } };
  };
  const pin = (l: MapLayout, slug: string) => l.markers.find((m) => m.id === `pin-${slug}`)!;
  const withBend = (bend: number) => (d: IslandData) => ({ ...d, routes: d.routes.map((r) => ({ ...r, bend })) });

  it('runs between the two pins', () => {
    const l = layoutOf('tenerife', 'hostels');
    const { a, b } = nums(l.routes[0]!.d);
    expect(a).toEqual({ x: pin(l, 'puerto-nest').x, y: pin(l, 'puerto-nest').y });
    expect(b).toEqual({ x: pin(l, 'arena-nest').x, y: pin(l, 'arena-nest').y });
  });

  for (const bend of [0.25, -0.6, 1]) {
    it(`bend ${bend}: the control point leaves the midpoint along the normal (−dy, dx) by bend·len/2`, () => {
      const { a, b, c } = nums(layoutOf('tenerife', 'hostels', {}, withBend(bend)).routes[0]!.d);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const n = { x: -dy / len, y: dx / len };
      const off = { x: c.x - (a.x + b.x) / 2, y: c.y - (a.y + b.y) / 2 };
      expect(off.x * n.x + off.y * n.y).toBeCloseTo((bend * len) / 2, 0);
      expect(Math.abs(off.x * dx + off.y * dy) / len).toBeLessThan(0.2);
    });
  }

  it('bend 0 is a straight line', () => {
    const { a, b, c } = nums(layoutOf('tenerife', 'hostels', {}, withBend(0)).routes[0]!.d);
    expect(c.x).toBeCloseTo((a.x + b.x) / 2, 0);
    expect(c.y).toBeCloseTo((a.y + b.y) / 2, 0);
  });

  it('is skipped when both ends share one pin', () => {
    const l = layoutOf('tenerife', 'hostels', {}, (d) => ({
      ...d,
      routes: [...d.routes, { id: 'medano-walk', from: 'ashavana-nest', to: 'los-amigos-nest', bend: 0, showOn: 'both', visible: true }],
    }));
    expect(l.routes.map((r) => r.id)).toEqual(['route-puerto-arena']);
  });

  it('is skipped when either hostel is hidden, or the route is', () => {
    const hideArena = (d: IslandData) => ({ ...d, hostels: d.hostels.map((h) => (h.slug === 'arena-nest' ? { ...h, visible: false } : h)) });
    expect(layoutOf('tenerife', 'hostels', {}, hideArena).routes).toEqual([]);
    const hideRoute = (d: IslandData) => ({ ...d, routes: d.routes.map((r) => ({ ...r, visible: false })) });
    expect(layoutOf('tenerife', 'hostels', {}, hideRoute).routes).toEqual([]);
  });
});

describe('markers and labels', () => {
  for (const id of ISLAND_IDS) {
    for (const layer of LAYERS) {
      it(`${id} ${layer}: markers are drawn top to bottom, so lower ones sit on top`, () => {
        const ys = layoutOf(id, layer).markers.map((m) => m.y);
        expect(ys).toEqual([...ys].sort((a, b) => a - b));
      });
    }
  }

  it('Tenerife hostels: 7 pins, 9 labels, the El Médano three on one pin', () => {
    const l = layoutOf('tenerife', 'hostels');
    expect(l.group).toBe('hostels');
    expect(l.markers).toHaveLength(7);
    expect(l.markers.every((m) => m.kind === 'pin' && m.scale === 0.9)).toBe(true);
    expect(l.markers.map((m) => m.id)).toContain('pin-ashavana-nest');
    expect(l.markers.map((m) => m.id)).not.toContain('pin-medano-nest');
    expect(l.labels.map((x) => x.id)).toEqual(ISLANDS.tenerife.seed.hostels.map((h) => `label-${h.slug}`));
  });

  it('stacks the El Médano labels at the shared pin, each with its own nudge and a leader', () => {
    const l = layoutOf('tenerife', 'hostels');
    const p = l.markers.find((m) => m.id === 'pin-ashavana-nest')!;
    const label = (slug: string) => l.labels.find((x) => x.key === slug)!;
    // Side "right" at pinSize 0.9: x + 14.4 + 8 + w/2 + dx, y − 27 + dy.
    for (const [slug, text, dy] of [['ashavana-nest', 'ASHAVANA', -46], ['medano-nest', 'MÉDANO', 0], ['los-amigos-nest', 'LOS AMIGOS', 46]] as const) {
      const w = [...text].length * (25 * 0.55 + 4.75) + 27.5;
      expect(label(slug).text).toBe(text);
      expect(label(slug).rect.w).toBeCloseTo(w, 1);
      expect(label(slug).x).toBeCloseTo(p.x + 22.4 + w / 2 + 16, 0);
      expect(label(slug).y).toBeCloseTo(p.y - 27 + dy, 0);
    }
    expect(l.leaders).toHaveLength(3);
    for (const leader of l.leaders) {
      expect(leader.x1).toBeCloseTo(p.x, 0);
      expect(leader.y1).toBeCloseTo(p.y - 27, 0);
    }
  });

  it('attractions never cluster and use badges', () => {
    const l = layoutOf('tenerife', 'attractions');
    expect(l.group).toBe('attractions');
    expect(l.markers).toHaveLength(ISLANDS.tenerife.seed.attractions.length);
    expect(l.markers.every((m) => m.kind === 'badge' && m.id.startsWith('spot-') && m.paths.length > 0)).toBe(true);
  });

  it('pin style dot draws dots with the pin scale', () => {
    const l = layoutOf('tenerife', 'hostels', { pinStyle: 'dot', pinSize: 1.2 });
    expect(l.markers.every((m) => m.kind === 'dot' && m.scale === 1.2)).toBe(true);
  });

  it('centres the pill on the label point and rounds it fully for the condensed face', () => {
    const { labels } = layoutOf('tenerife', 'hostels');
    const aguere = labels.find((x) => x.key === 'aguere-nest')!;
    expect(aguere.rect).toEqual({ x: -aguere.rect.w / 2, y: -17.75, w: aguere.rect.w, h: 35.5, r: 17.75 });
    expect(aguere.fill).toBe(PALETTES.original.accent);
    expect(aguere.color).toBe(PALETTES.original.ink);
  });

  it('text style: ink text with a white halo 0.32·fs wide and no pill', () => {
    const l = layoutOf('tenerife', 'hostels', { labelStyle: 'text' });
    expect(l.labels.every((x) => x.fill === null)).toBe(true);
    expect(l.text.halo).toBe(8);
    expect(layoutOf('tenerife', 'hostels').text.halo).toBe(0);
  });

  it('gives each label the whole-pixel nudge range that keeps its pill inside the box, for the editor’s drag', () => {
    for (const layer of LAYERS) {
      const l = layoutOf('tenerife', layer);
      const items = layer === 'hostels' ? ISLANDS.tenerife.seed.hostels : ISLANDS.tenerife.seed.attractions;
      for (const label of l.labels) {
        const { dx, dy } = label.nudge;
        for (const n of [...dx, ...dy]) expect(Number.isInteger(n)).toBe(true);
        expect(dx[0]).toBeLessThanOrEqual(dx[1]);
        expect(dy[0]).toBeLessThanOrEqual(dy[1]);
        // Nudged to each corner of its range, the pill stays in the box without being clamped.
        for (const [x, y] of [[dx[0], dy[0]], [dx[1], dy[1]]] as const) {
          const moved = layoutOf('tenerife', layer, {}, (d) => ({
            ...d,
            [layer]: items.map((i) => (('slug' in i ? i.slug : i.id) === label.key ? { ...i, labelPlacement: { ...i.labelPlacement, dx: x, dy: y } } : i)),
          })).labels.find((m) => m.key === label.key)!;
          expect(moved.x + moved.rect.x).toBeGreaterThanOrEqual(LABEL_BOX.x0 - 0.05);
          expect(moved.x - moved.rect.x).toBeLessThanOrEqual(LABEL_BOX.x1 + 0.05);
          expect(moved.y + moved.rect.y).toBeGreaterThanOrEqual(LABEL_BOX.y0 - 0.05);
          expect(moved.y - moved.rect.y).toBeLessThanOrEqual(LABEL_BOX.y1 + 0.05);
          expect(moved.nudge).toEqual(label.nudge);
        }
      }
    }
  });

  it('text sits at x = ls/2, y = fs·0.36 in the label face', () => {
    expect(layoutOf('tenerife', 'hostels').text).toEqual({ family: 'Roboto Condensed', weight: 700, size: 25, letterSpacing: 4.75, x: 2.4, y: 9, halo: 0 });
  });
});

describe('rounding', () => {
  const walk = (v: unknown, out: number[]) => {
    if (typeof v === 'number') out.push(v);
    else if (typeof v === 'string') for (const n of v.match(/-?\d+(?:\.\d+)?/g) ?? []) out.push(Number(n));
    else if (Array.isArray(v)) v.forEach((x) => walk(x, out));
    // Icon paths are Lucide's data, written as they come.
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => k !== 'paths' && walk(x, out));
  };
  const maps = ISLAND_IDS.flatMap((id) => LAYERS.map((layer) => [id, layer] as const));

  it('every number in the layout has at most 2 decimals', () => {
    for (const [id, layer] of maps) {
      for (const patch of [{}, { labelSize: 23.3, labelTracking: 0.17, pinSize: 1.13 }, { labelFont: 'poppins' as const }]) {
        const numbers: number[] = [];
        const { palette: _, rings: __, coast: ___, ...rest } = layoutOf(id, layer, patch);
        walk(rest, numbers);
        for (const n of numbers) expect(Math.round(n * 100) / 100, `${id} ${layer} ${n}`).toBe(n);
      }
    }
  });

  it('positions have at most 1 decimal', () => {
    for (const [id, layer] of maps) {
      const l = layoutOf(id, layer, { pinSize: 1.13 });
      const positions = [
        ...l.markers.flatMap((m) => [m.x, m.y]),
        ...l.labels.flatMap((x) => [x.x, x.y]),
        ...l.decor.flatMap((d) => [d.x, d.y]),
        ...l.leaders.flatMap((x) => [x.x1, x.y1, x.x2, x.y2]),
      ];
      for (const n of positions) expect(Math.round(n * 10) / 10).toBe(n);
    }
  });
});
