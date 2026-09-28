import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDraftStore, seedHash, type Draft } from '../../src/editor/autosave.js';
import { STORAGE_KEYS } from '../../src/editor/browserStorage.js';
import { applyEdit, setLabel, setSettings } from '../../src/editor/state.js';
import { seedWorkspace } from '../../src/editor/workspace.js';
import { serializeDataFile } from '../../src/shared/datafile.js';
import { ISLAND_LIST, ISLANDS, type IslandEntry } from '../../src/shared/islands.js';
import { RING_COUNT } from '../../src/shared/tokens.js';
import { mapStorage, throwing } from './storage.js';

/* The localStorage autosave (spec §3 "Storage (v1)", plan decision 9): the
   islands edited since their seed, each with a hash of the seed it was built
   on. A newer committed seed raises a persistent warning instead of silently
   winning or losing; a draft that can't be read falls back to the seeds and
   says so; storage that throws never breaks the editor. */

const KEY = STORAGE_KEYS.draft;
const DELAY = 50;
const T = ISLANDS.tenerife;

const bytes = (d: Draft['workspace'][keyof Draft['workspace']], island: IslandEntry = T) => serializeDataFile(d, island.geometry);
const stored = (s: Storage) => JSON.parse(s.getItem(KEY) ?? 'null');

/** The seeds with Adeje renamed on Tenerife. */
function editedDraft(): Draft {
  const store = createDraftStore(undefined);
  const { workspace, bases } = store.load();
  return { workspace: applyEdit(workspace, T, setLabel('hostels', 'adeje-nest', 'Adeje Beach')), bases };
}

/** The same islands, but with Tenerife's seed republished with one change: a newer commit. */
function republished(seed = T.seed): IslandEntry[] {
  return ISLAND_LIST.map((i) => (i.id === 'tenerife' ? { ...i, seed } : i));
}
/** Tenerife's seed with one real change, whatever today's seed holds: the first hostel's verified flag flipped. */
const newerSeed = () => ({ ...T.seed, hostels: T.seed.hostels.map((h, i) => (i === 0 ? { ...h, coordsVerified: !h.coordsVerified } : h)) });
/** Ring counts other than the island's seed has, so an edit is always a change whatever the seed says. */
const otherRings = (island: IslandEntry) => Array.from({ length: RING_COUNT + 1 }, (_, n) => n).filter((n) => n !== island.seed.settings.rings);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('saving', () => {
  it('stores only the islands that differ from their seed, with the seed they were built on', () => {
    const s = mapStorage();
    const store = createDraftStore(s, { delayMs: DELAY });
    store.load();
    store.save(editedDraft());
    store.flush();
    const file = stored(s);
    expect(file.version).toBe(1);
    expect(Object.keys(file.islands)).toEqual(['tenerife']);
    expect(file.islands.tenerife.base).toBe(seedHash(T));
    expect(file.islands.tenerife.data.hostels.find((h: { slug: string }) => h.slug === 'adeje-nest').label).toBe('Adeje Beach');
  });

  it('debounces: one write after the edits settle, or at once on flush', () => {
    const s = mapStorage();
    const store = createDraftStore(s, { delayMs: DELAY });
    const { workspace, bases } = store.load();
    for (const label of ['A', 'Ad', 'Ade']) store.save({ workspace: applyEdit(workspace, T, setLabel('hostels', 'adeje-nest', label)), bases });
    vi.advanceTimersByTime(DELAY - 1);
    expect(s.writes).toBe(0);
    vi.advanceTimersByTime(1);
    expect(s.writes).toBe(1);
    expect(stored(s).islands.tenerife.data.hostels.find((h: { slug: string }) => h.slug === 'adeje-nest').label).toBe('Ade');

    store.save(editedDraft());
    store.flush();
    expect(s.writes).toBe(2);
  });

  it('writes nothing while nothing has changed, so an idle tab never overwrites a busy one', () => {
    const s = mapStorage();
    const store = createDraftStore(s, { delayMs: DELAY });
    store.save(store.load());
    store.flush();
    expect(s.writes).toBe(0);

    store.save(editedDraft());
    store.flush();
    const again = createDraftStore(s, { delayMs: DELAY });
    again.save(again.load());
    again.flush();
    expect(s.writes).toBe(1);
  });

  it('clears the draft once every island is back to its seed', () => {
    const s = mapStorage();
    const store = createDraftStore(s, { delayMs: DELAY });
    const seeds = store.load();
    store.save(editedDraft());
    store.flush();
    store.save(seeds);
    store.flush();
    expect(s.getItem(KEY)).toBeNull();
  });
});

describe('loading', () => {
  it('starts from the seeds when nothing is stored', () => {
    const loaded = createDraftStore(mapStorage()).load();
    expect(loaded.workspace).toEqual(seedWorkspace());
    expect(loaded.problems).toEqual([]);
  });

  it('brings the edits back on the next visit', () => {
    const s = mapStorage();
    const draft = editedDraft();
    const store = createDraftStore(s, { delayMs: DELAY });
    store.load();
    store.save(draft);
    store.flush();

    const next = createDraftStore(s).load();
    expect(bytes(next.workspace.tenerife)).toBe(bytes(draft.workspace.tenerife));
    expect(next.workspace.ibiza).toBe(ISLANDS.ibiza.seed);
    expect(createDraftStore(s).stale(next.bases)).toEqual([]);
  });

  it('reads a draft of one island and ignores islands it does not know, however odd', () => {
    const data = editedDraft().workspace.tenerife;
    for (const stranger of [{ base: 'x', data: {} }, 42, null]) {
      const s = mapStorage();
      s.setItem(KEY, JSON.stringify({ version: 1, islands: { tenerife: { base: seedHash(T), data }, mallorca: stranger } }));
      const loaded = createDraftStore(s).load();
      expect(bytes(loaded.workspace.tenerife)).toBe(bytes(data));
      expect(loaded.problems).toEqual([]);
    }
  });

  it('reports a known island whose entry is not an island draft at all', () => {
    const s = mapStorage();
    s.setItem(KEY, JSON.stringify({ version: 1, islands: { ibiza: 42 } }));
    expect(createDraftStore(s).load().problems).toEqual([{ island: 'ibiza', error: 'not a saved island draft' }]);
  });

  it('falls back to the seed for an island whose draft is invalid, and keeps the others', () => {
    const s = mapStorage();
    const good = editedDraft().workspace.tenerife;
    const bad = { ...ISLANDS.ibiza.seed, hostels: [{ ...ISLANDS.ibiza.seed.hostels[0]!, slug: 'new-nest' }] };
    s.setItem(KEY, JSON.stringify({ version: 1, islands: { tenerife: { base: seedHash(T), data: good }, ibiza: { base: 'x', data: bad } } }));
    const loaded = createDraftStore(s).load();
    expect(bytes(loaded.workspace.tenerife)).toBe(bytes(good));
    expect(loaded.workspace.ibiza).toBe(ISLANDS.ibiza.seed);
    expect(loaded.problems).toEqual([{ island: 'ibiza', error: expect.stringMatching(/hostels\.0\.slug/) }]);
  });

  describe('an unreadable island draft', () => {
    const bad = { base: 'x', data: { island: 'ibiza', broken: true } };
    function withBadIbiza() {
      const s = mapStorage();
      s.setItem(KEY, JSON.stringify({ version: 1, islands: { ibiza: bad } }));
      const store = createDraftStore(s, { delayMs: DELAY });
      return { s, store, loaded: store.load() };
    }

    it('stays in storage while other islands are saved, until the notice is dismissed', () => {
      const { s, store, loaded } = withBadIbiza();
      expect(loaded.problems).toEqual([{ island: 'ibiza', error: expect.any(String) }]);
      store.save(editedDraft());
      store.flush();
      expect(stored(s).islands).toEqual({ tenerife: expect.anything(), ibiza: bad });

      store.dismiss('ibiza');
      store.flush();
      expect(Object.keys(stored(s).islands)).toEqual(['tenerife']);
    });

    it('gives way to new edits of that island, for good', () => {
      const { s, store, loaded } = withBadIbiza();
      const rings = otherRings(ISLANDS.ibiza)[0]!;
      store.save({ ...loaded, workspace: applyEdit(loaded.workspace, ISLANDS.ibiza, setSettings({ rings })) });
      store.flush();
      expect(stored(s).islands.ibiza.data.settings.rings).toBe(rings);
      // Undoing the edit must not bring the unreadable entry back.
      store.save(loaded);
      store.flush();
      expect(s.getItem(KEY)).toBeNull();
    });

    it('is released by an edit even when the edit is undone before the save settles', () => {
      const { s, store, loaded } = withBadIbiza();
      store.save({ ...loaded, workspace: applyEdit(loaded.workspace, ISLANDS.ibiza, setSettings({ rings: otherRings(ISLANDS.ibiza)[0]! })) });
      store.save(loaded);
      store.flush();
      expect(s.getItem(KEY)).toBeNull();
    });
  });

  describe.each([
    ['junk', 'not json'],
    ['another version', JSON.stringify({ version: 2, islands: {} })],
    ['the wrong shape', '[]'],
  ])('a draft that is %s', (_, text) => {
    function withUnreadable() {
      const s = mapStorage();
      s.setItem(KEY, text);
      const store = createDraftStore(s, { delayMs: DELAY });
      return { s, store, loaded: store.load() };
    }

    it('reads as no draft, is reported, and stays in storage while nothing is edited', () => {
      const { s, store, loaded } = withUnreadable();
      expect(loaded.workspace).toEqual(seedWorkspace());
      expect(loaded.problems).toEqual([{ error: 'not a draft this editor can read' }]);
      store.save(loaded);
      store.flush();
      expect(s.getItem(KEY)).toBe(text);
    });

    it('gives way to the first edit, for good', () => {
      const { s, store, loaded } = withUnreadable();
      store.save(editedDraft());
      store.flush();
      expect(Object.keys(stored(s).islands)).toEqual(['tenerife']);
      store.save(loaded);
      store.flush();
      expect(s.getItem(KEY)).toBeNull();
    });

    it('is released by an edit even when the edit is undone before the save settles', () => {
      const { s, store, loaded } = withUnreadable();
      store.save(editedDraft());
      store.save(loaded);
      store.flush();
      expect(s.getItem(KEY)).toBeNull();
    });

    it('goes when its notice is dismissed', () => {
      const { s, store } = withUnreadable();
      store.dismiss();
      expect(s.getItem(KEY)).toBeNull();
      expect(createDraftStore(s).load().problems).toEqual([]);
    });
  });
});

describe('a newer published seed (decision 9)', () => {
  function draftOnOldSeed() {
    const s = mapStorage();
    const store = createDraftStore(s, { delayMs: DELAY });
    store.load();
    store.save(editedDraft());
    store.flush();
    return s;
  }

  it('shows the draft and reports the island as stale', () => {
    const s = draftOnOldSeed();
    const store = createDraftStore(s, { islands: republished(newerSeed()) });
    const loaded = store.load();
    expect(loaded.workspace.tenerife.hostels.find((h) => h.slug === 'adeje-nest')!.label).toBe('Adeje Beach');
    expect(store.stale(loaded.bases)).toEqual(['tenerife']);
  });

  it('keeps warning, through saves and reloads, until someone chooses', () => {
    const s = draftOnOldSeed();
    const islands = republished(newerSeed());
    const store = createDraftStore(s, { islands, delayMs: DELAY });
    const loaded = store.load();
    store.save({ ...loaded, workspace: applyEdit(loaded.workspace, T, setSettings({ rings: otherRings(T)[0]! })) });
    store.flush();
    const again = createDraftStore(s, { islands });
    expect(again.stale(again.load().bases)).toEqual(['tenerife']);
  });

  it('"Keep draft" stops the warning and keeps the edits', () => {
    const s = draftOnOldSeed();
    const islands = republished(newerSeed());
    const store = createDraftStore(s, { islands, delayMs: DELAY });
    const loaded = store.load();
    const bases = store.rebase(loaded.bases, 'tenerife');
    expect(store.stale(bases)).toEqual([]);
    store.save({ workspace: loaded.workspace, bases });
    store.flush();
    const again = createDraftStore(s, { islands }).load();
    expect(createDraftStore(s, { islands }).stale(again.bases)).toEqual([]);
    expect(again.workspace.tenerife.hostels.find((h) => h.slug === 'adeje-nest')!.label).toBe('Adeje Beach');
  });

  it('"Load published" takes the new seed and clears the draft', () => {
    const s = draftOnOldSeed();
    const seed = newerSeed();
    const islands = republished(seed);
    const store = createDraftStore(s, { islands, delayMs: DELAY });
    const loaded = store.load();
    store.save({ workspace: { ...loaded.workspace, tenerife: seed }, bases: store.rebase(loaded.bases, 'tenerife') });
    store.flush();
    expect(s.getItem(KEY)).toBeNull();
  });

  it('drops a draft silently once it has been published as the seed (download, commit, reload)', () => {
    const s = draftOnOldSeed();
    const published = editedDraft().workspace.tenerife;
    const store = createDraftStore(s, { islands: republished(published), delayMs: DELAY });
    const loaded = store.load();
    expect(store.stale(loaded.bases)).toEqual([]);
    expect(loaded.problems).toEqual([]);
    store.save(loaded);
    store.flush();
    expect(s.getItem(KEY)).toBeNull();
  });

  it('tells the published seed from anything else, by its file bytes', () => {
    const store = createDraftStore(undefined);
    expect(store.isSeed('tenerife', T.seed)).toBe(true);
    expect(store.isSeed('tenerife', editedDraft().workspace.tenerife)).toBe(false);
    // Setting what the seed already has leaves the seed.
    expect(store.isSeed('tenerife', applyEdit(seedWorkspace(), T, setSettings({ rings: T.seed.settings.rings })).tenerife)).toBe(true);
  });

  it('hashes the seed file itself', () => {
    expect(seedHash(T)).toMatch(/^[0-9a-f]{8}$/);
    expect(seedHash(T)).not.toBe(seedHash({ ...T, seed: newerSeed() }));
    expect(new Set(ISLAND_LIST.map(seedHash)).size).toBe(3);
  });
});

describe('storage that fails', () => {
  it('survives storage that throws, and reports a failed save once', () => {
    const onSaveError = vi.fn();
    const store = createDraftStore(throwing, { delayMs: DELAY, onSaveError });
    const loaded = store.load();
    expect(loaded.workspace).toEqual(seedWorkspace());
    expect(() => {
      store.save(editedDraft());
      store.flush();
      store.save({ ...editedDraft(), workspace: applyEdit(editedDraft().workspace, T, setSettings({ rings: otherRings(T)[0]! })) });
      store.flush();
    }).not.toThrow();
    expect(onSaveError).toHaveBeenCalledTimes(1);
  });

  it('reports again after a save has worked in between', () => {
    const s = mapStorage();
    let broken = true;
    const flaky: Storage = {
      ...s,
      getItem: (k) => s.getItem(k),
      removeItem: (k) => s.removeItem(k),
      setItem(k, v) {
        if (broken) throw new Error('QuotaExceededError');
        s.setItem(k, v);
      },
    };
    const onSaveError = vi.fn();
    const store = createDraftStore(flaky, { delayMs: DELAY, onSaveError });
    const { workspace, bases } = store.load();
    const edit = (rings: number) => {
      store.save({ workspace: applyEdit(workspace, T, setSettings({ rings })), bases });
      store.flush();
    };
    const [a, b, c] = otherRings(T);
    edit(a!);
    edit(b!);
    expect(onSaveError).toHaveBeenCalledTimes(1);
    broken = false;
    edit(c!);
    expect(onSaveError).toHaveBeenCalledTimes(1);
    broken = true;
    edit(a!);
    expect(onSaveError).toHaveBeenCalledTimes(2);
  });

  it('works without storage at all, and says edits are not being kept', () => {
    const onSaveError = vi.fn();
    const store = createDraftStore(undefined, { delayMs: DELAY, onSaveError });
    expect(store.load().workspace).toEqual(seedWorkspace());
    store.save(editedDraft());
    store.flush();
    expect(onSaveError).toHaveBeenCalledTimes(1);
  });
});
