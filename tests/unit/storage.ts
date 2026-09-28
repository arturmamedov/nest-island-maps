/* Stand-ins for window.localStorage, shared by every test of browser-stored
   state (the preview background, the autosaved draft). Real storage can be
   missing, hold junk or throw (private windows, blocked site data, a full
   quota), and none of that may break the editor. */

/** An in-memory Storage, with a count of writes so tests can tell a save from a skip. */
export function mapStorage(): Storage & { writes: number } {
  const m = new Map<string, string>();
  return {
    writes: 0,
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem(k) {
      this.writes++;
      m.delete(k);
    },
    setItem(k, v) {
      this.writes++;
      m.set(k, String(v));
    },
  };
}

/** Storage that refuses every read and write, as blocked site data or a full quota does. */
export const throwing: Storage = {
  length: 0,
  clear() {},
  key: () => null,
  getItem() {
    throw new Error('SecurityError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};
