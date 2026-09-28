import { ISLAND_LIST, type IslandEntry } from '../shared/islands';
import type { IslandData, IslandId } from '../shared/schema';

/* What the editor holds: one data file per island, the same shape as a seed
   and as Download JSON. It starts as the published seeds with the autosaved
   draft laid over them (autosave.ts), and changes only through the pure edits
   of state.ts. */

export type Workspace = Record<IslandId, IslandData>;

/** The committed seeds, one per island. */
export function seedWorkspace(islands: readonly IslandEntry[] = ISLAND_LIST): Workspace {
  return Object.fromEntries(islands.map((i) => [i.id, i.seed])) as Workspace;
}
