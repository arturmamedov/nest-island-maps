import { project, type Point, type ProjectionConstants } from './geo.js';
import type { Hostel } from './schema.js';
import { CLUSTER_PX } from './tokens.js';

/* Hostels closer than CLUSTER_PX share one pin (handoff README §1). The rule
   is single linkage over every pair (union-find), so the groups depend only on
   where the hostels are, never on the order they are listed in; the
   prototype's greedy pass could split or merge the same points differently
   after a reorder. Only visible hostels take part, and attractions never
   cluster. */

/** Groups point indices whose chain of neighbours is closer than `maxDist`. Members and groups are in data order. */
export function singleLinkage(points: readonly Point[], maxDist: number = CLUSTER_PX): number[][] {
  const parent = points.map((_, i) => i);
  const root = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!;
    return i;
  };
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < maxDist) {
        // The smaller index stays the root, so a group is named by its first member.
        const [ri, rj] = [root(i), root(j)];
        parent[Math.max(ri, rj)] = Math.min(ri, rj);
      }
    }
  }
  const groups = new Map<number, number[]>();
  points.forEach((_, i) => {
    const r = root(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  });
  return [...groups.values()];
}

export type ClusterMember = { hostel: Hostel; x: number; y: number };

/** One pin: `id` is the slug of its first member in data order; x, y the members' mean (the pin tip). */
export type HostelCluster = { id: string; x: number; y: number; members: ClusterMember[] };

export function clusterHostels(hostels: readonly Hostel[], projection: ProjectionConstants): HostelCluster[] {
  const members: ClusterMember[] = hostels.filter((h) => h.visible).map((hostel) => ({ hostel, ...project(projection, hostel.lat, hostel.lng) }));
  return singleLinkage(members).map((group) => {
    const ms = group.map((i) => members[i]!);
    const mean = (k: 'x' | 'y') => ms.reduce((sum, m) => sum + m[k], 0) / ms.length;
    return { id: ms[0]!.hostel.slug, x: mean('x'), y: mean('y'), members: ms };
  });
}
