import { z } from 'zod';
import { parseDataFile, serializeDataFile } from '../shared/datafile';
import { ISLAND_LIST, type IslandEntry } from '../shared/islands';
import type { IslandData, IslandId } from '../shared/schema';
import { STORAGE_KEYS } from './browserStorage';
import { seedWorkspace, type Workspace } from './workspace';

/* The localStorage autosave (spec §3 "Storage (v1)"). The draft holds only
   the islands edited since their published seed, each with a hash of the seed
   it was built on (plan decision 9). When a newer seed is committed (verified
   coordinates, say), that island's draft is still shown, but a persistent
   warning offers "Load published" or "Keep draft"; until someone chooses,
   saves keep the old hash, so the warning survives edits and reloads.

   Storing only edited islands means an untouched island never warns, and a
   draft that was downloaded and committed as the new seed simply dissolves.
   A save that would write what storage already holds is skipped, so opening
   a second tab never overwrites the first one's work (two tabs that both
   edit: the last save wins). A draft that can't be read falls back to the
   seeds, is reported, and stays in storage until it is replaced by an edit or
   the notice is dismissed: nothing is lost without a word. Every storage call
   is guarded, because storage can be missing, full, or blocked. */

const KEY = STORAGE_KEYS.draft;
const VERSION = 1;
export const SAVE_DELAY_MS = 400;

/** The seed hash each island's data was built on. */
export type Bases = Record<IslandId, string>;
export type Draft = { workspace: Workspace; bases: Bases };
/** A draft, or one island of it, that could not be read. No `island`: the whole draft. */
export type DraftProblem = { island?: IslandId; error: string };
export type LoadedDraft = Draft & { problems: DraftProblem[] };

export type DraftStore = {
  /** The seeds with the stored draft laid over them. */
  load(): LoadedDraft;
  /** Saves after the edits settle (debounced). */
  save(draft: Draft): void;
  /** Writes a pending save now, e.g. when the page is hidden. */
  flush(): void;
  /** Islands whose draft was built on an older seed than the one published now. */
  stale(bases: Bases): IslandId[];
  /** Marks an island as built on the current seed: "Keep draft", "Load published", reset and import. */
  rebase(bases: Bases, island: IslandId): Bases;
  /** Lets go of an unreadable draft (one island's, or the whole one). */
  dismiss(island?: IslandId): void;
  /** Whether this is the island's published seed. Anything else replaces an unreadable draft of it when saved. */
  isSeed(island: IslandId, data: IslandData): boolean;
};

type Options = {
  islands?: readonly IslandEntry[];
  delayMs?: number;
  /** Called once when a save fails, until one succeeds again. */
  onSaveError?: () => void;
};

const StoredIslandSchema = z.object({ base: z.string(), data: z.unknown() });
// Entries are checked one island at a time, so an unknown or odd entry can't void the rest.
const DraftFileSchema = z.object({ version: z.literal(VERSION), islands: z.record(z.string(), z.unknown()) });

/** 32-bit FNV-1a, as 8 hex digits: a change detector, not a checksum anyone relies on. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** A hash of the seed file's own bytes (the Download JSON form). */
export const seedHash = (island: IslandEntry) => fnv1a(serializeDataFile(island.seed, island.geometry));

export function createDraftStore(storage: Storage | undefined, { islands = ISLAND_LIST, delayMs = SAVE_DELAY_MS, onSaveError }: Options = {}): DraftStore {
  const seedBytes = new Map(islands.map((i) => [i.id, serializeDataFile(i.seed, i.geometry)]));
  const hashes = Object.fromEntries(islands.map((i) => [i.id, fnv1a(seedBytes.get(i.id)!)])) as Bases;
  const entries = new Map(islands.map((i) => [i.id, i]));
  const isSeed = (island: IslandEntry, data: IslandData) => serializeDataFile(data, island.geometry) === seedBytes.get(island.id);

  // Unreadable drafts, written back unchanged until replaced or dismissed.
  const keptIslands = new Map<IslandId, unknown>();
  let keptWhole: string | null = null;

  let lastText: string | null = null; // what storage holds, as far as this tab knows
  let latest: Draft | null = null;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failing = false;

  /** The islands whose data differs from their published seed. */
  const editedIn = (draft: Draft) => new Set(islands.filter((i) => !isSeed(i, draft.workspace[i.id])).map((i) => i.id));

  /** The text to store; null means no draft at all. */
  function serialize(draft: Draft, edited: ReadonlySet<IslandId>): string | null {
    const out: Record<string, unknown> = {};
    for (const { id } of islands) {
      if (edited.has(id)) out[id] = { base: draft.bases[id], data: draft.workspace[id] };
      else if (keptIslands.has(id)) out[id] = keptIslands.get(id)!;
    }
    if (Object.keys(out).length === 0) return keptWhole;
    return JSON.stringify({ version: VERSION, islands: out });
  }

  function write(text: string | null) {
    if (text === lastText) return;
    try {
      if (!storage) throw new Error('No storage in this browser');
      if (text === null) storage.removeItem(KEY);
      else storage.setItem(KEY, text);
      lastText = text;
      failing = false;
    } catch {
      if (!failing) onSaveError?.();
      failing = true;
    }
  }

  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (!pending || !latest) return;
    pending = false;
    write(serialize(latest, editedIn(latest)));
  }

  function read(): string | null {
    try {
      return storage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }

  function parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  return {
    load() {
      const workspace = seedWorkspace(islands);
      const bases = { ...hashes };
      const problems: DraftProblem[] = [];
      const text = read();
      lastText = text;
      latest = { workspace, bases };
      if (text === null) return { workspace, bases, problems };

      const file = DraftFileSchema.safeParse(parseJson(text));
      if (!file.success) {
        keptWhole = text;
        problems.push({ error: 'not a draft this editor can read' });
        return { workspace, bases, problems };
      }
      const unreadable = (id: IslandId, raw: unknown, error: string) => {
        keptIslands.set(id, raw);
        problems.push({ island: id, error });
      };
      for (const island of islands) {
        const raw = file.data.islands[island.id];
        if (raw === undefined) continue;
        const entry = StoredIslandSchema.safeParse(raw);
        if (!entry.success) {
          unreadable(island.id, raw, 'not a saved island draft');
          continue;
        }
        const r = parseDataFile(entry.data.data, island);
        if (!r.ok) {
          unreadable(island.id, raw, r.error);
          continue;
        }
        // A draft identical to the published seed was published: nothing left to keep.
        if (isSeed(island, r.data)) continue;
        workspace[island.id] = r.data;
        bases[island.id] = entry.data.base;
      }
      return { workspace, bases, problems };
    },

    save(draft) {
      /* An edit replaces what it covers, at once rather than when the debounce
         ends: that island's unreadable entry, or an unreadable draft as a
         whole. The App drops the matching notice at the same edit. */
      const edited = editedIn(draft);
      for (const id of edited) keptIslands.delete(id);
      if (edited.size > 0) keptWhole = null;
      latest = draft;
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },

    flush,

    stale: (bases) => islands.filter((i) => bases[i.id] !== hashes[i.id]).map((i) => i.id),

    rebase: (bases, island) => ({ ...bases, [island]: hashes[island] }),

    dismiss(island) {
      if (island) keptIslands.delete(island);
      else keptWhole = null;
      pending = true;
      flush();
    },

    isSeed: (island, data) => isSeed(entries.get(island)!, data),
  };
}
