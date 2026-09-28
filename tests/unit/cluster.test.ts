import { describe, expect, it } from 'vitest';
import { clusterHostels, singleLinkage } from '../../src/shared/cluster.js';
import { ISLANDS } from '../../src/shared/islands.js';

/* Hostels closer than 14 px share one pin (handoff README §1). Single linkage
   makes the grouping a property of the points, not of the order they are
   listed in; the prototype's greedy pass was not. */

const tenerife = ISLANDS.tenerife;
const memberSets = (clusters: ReturnType<typeof clusterHostels>) =>
  clusters.map((c) => c.members.map((m) => m.hostel.slug).sort().join('+')).sort();

describe('singleLinkage', () => {
  it('chains points whose neighbours are close even when the ends are not', () => {
    const chain = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    for (const order of [[0, 1, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0]]) {
      expect(singleLinkage(order.map((i) => chain[i]!))).toEqual([[0, 1, 2]]);
    }
  });

  it('keeps points exactly 14 px apart separate', () => {
    expect(singleLinkage([{ x: 0, y: 0 }, { x: 14, y: 0 }])).toEqual([[0], [1]]);
  });

  it('orders groups by their first member, members in data order', () => {
    const pts = [
      { x: 100, y: 0 },
      { x: 0, y: 0 },
      { x: 105, y: 0 },
      { x: 5, y: 0 },
    ];
    expect(singleLinkage(pts)).toEqual([[0, 2], [1, 3]]);
  });
});

describe('clusterHostels', () => {
  it("gives Tenerife's 9 hostels 7 pins, one for the El Médano three", () => {
    const clusters = clusterHostels(tenerife.seed.hostels, tenerife.geometry.projection);
    expect(tenerife.seed.hostels).toHaveLength(9);
    expect(clusters).toHaveLength(7);
    const medano = clusters.find((c) => c.members.length > 1)!;
    expect(medano.members.map((m) => m.hostel.slug)).toEqual(['ashavana-nest', 'medano-nest', 'los-amigos-nest']);
    expect(medano.id).toBe('ashavana-nest');
  });

  it('places the pin at the mean of its members', () => {
    const clusters = clusterHostels(tenerife.seed.hostels, tenerife.geometry.projection);
    const medano = clusters.find((c) => c.id === 'ashavana-nest')!;
    const mean = (k: 'x' | 'y') => medano.members.reduce((s, m) => s + m[k], 0) / medano.members.length;
    expect(medano.x).toBeCloseTo(mean('x'), 9);
    expect(medano.y).toBeCloseTo(mean('y'), 9);
  });

  it('gives the same clusters whatever the hostel order', () => {
    const expected = memberSets(clusterHostels(tenerife.seed.hostels, tenerife.geometry.projection));
    const reversed = [...tenerife.seed.hostels].reverse();
    const rotated = [...tenerife.seed.hostels.slice(4), ...tenerife.seed.hostels.slice(0, 4)];
    const interleaved = [...tenerife.seed.hostels.filter((_, i) => i % 2), ...tenerife.seed.hostels.filter((_, i) => !(i % 2))];
    for (const hostels of [reversed, rotated, interleaved]) {
      expect(memberSets(clusterHostels(hostels, tenerife.geometry.projection))).toEqual(expected);
    }
  });

  it('ignores hidden hostels', () => {
    const hostels = tenerife.seed.hostels.map((h) => (h.slug === 'ashavana-nest' || h.slug === 'aguere-nest' ? { ...h, visible: false } : h));
    const clusters = clusterHostels(hostels, tenerife.geometry.projection);
    const slugs = clusters.flatMap((c) => c.members.map((m) => m.hostel.slug));
    expect(slugs).not.toContain('ashavana-nest');
    expect(slugs).not.toContain('aguere-nest');
    expect(clusters).toHaveLength(6);
    // Médano and Los Amigos are 8.1 px apart, so they still share a pin, now named after Médano.
    expect(clusters.find((c) => c.members.length > 1)!.id).toBe('medano-nest');
  });
});
