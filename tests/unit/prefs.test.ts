import { describe, expect, it } from 'vitest';
import { loadPreviewBackground, PREVIEW_BACKGROUNDS, savePreviewBackground } from '../../src/editor/prefs.js';

/* The preview background is a per-viewer preference in localStorage. Storage
   can be absent, hold junk, or throw (private windows, blocked site data);
   none of that may break the editor, which then shows White. */

function mapStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const throwing: Storage = {
  length: 0,
  clear() {},
  key: () => null,
  getItem() {
    throw new Error('SecurityError');
  },
  removeItem() {},
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

describe('preview background preference', () => {
  it('offers White and the spec Focus surface', () => {
    expect(PREVIEW_BACKGROUNDS).toEqual({ white: '#FFFFFF', focus: 'linear-gradient(to top left, #53CED1, #0D6F82 50%, #083344)' });
  });

  it('defaults to White with empty or missing storage', () => {
    expect(loadPreviewBackground(mapStorage())).toBe('white');
    expect(loadPreviewBackground(undefined)).toBe('white');
  });

  it('remembers the choice', () => {
    const storage = mapStorage();
    savePreviewBackground(storage, 'focus');
    expect(loadPreviewBackground(storage)).toBe('focus');
  });

  it('ignores values it does not know, including inherited keys', () => {
    for (const junk of ['blue', 'toString', '']) {
      const storage = mapStorage();
      savePreviewBackground(storage, 'focus');
      storage.setItem(storage.key(0)!, junk);
      expect(loadPreviewBackground(storage)).toBe('white');
    }
  });

  it('survives storage that throws', () => {
    expect(loadPreviewBackground(throwing)).toBe('white');
    expect(() => savePreviewBackground(throwing, 'focus')).not.toThrow();
  });
});
