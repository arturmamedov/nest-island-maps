import { ISLAND_LIST } from '../shared/islands';
import type { IslandData, IslandId } from '../shared/schema';

/* What the editor holds: one data file per island, the same shape as a seed
   and as Download JSON. In M3 it is the three published seeds, read-only;
   M4 adds the pure edits (state.ts) and the autosaved draft. */

export type Workspace = Record<IslandId, IslandData>;

/** The committed seeds, one per island. */
export function seedWorkspace(): Workspace {
  return Object.fromEntries(ISLAND_LIST.map((i) => [i.id, i.seed])) as Workspace;
}
