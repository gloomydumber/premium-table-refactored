const PREFIX = 'premium-table:prefs:';

export function buildPrefsKey(marketKeyA: string, marketKeyB: string): string {
  return `${PREFIX}${marketKeyA}|${marketKeyB}`;
}

export function savePrefs(
  key: string,
  pinned: Set<string>,
  muted: Set<string>,
  openRows: Set<string>,
): void {
  try {
    const json = JSON.stringify({
      pinned: [...pinned],
      muted: [...muted],
      openRows: [...openRows],
    });
    localStorage.setItem(key, json);
  } catch {
    // Private browsing, storage quota, etc. — silently ignore
  }
}

interface Prefs {
  pinned: Set<string>;
  muted: Set<string>;
  openRows: Set<string>;
}

export function loadPrefs(key: string): Prefs {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { pinned: new Set(), muted: new Set(), openRows: new Set() };
    const parsed = JSON.parse(raw);
    return {
      pinned: new Set(Array.isArray(parsed.pinned) ? parsed.pinned : []),
      muted: new Set(Array.isArray(parsed.muted) ? parsed.muted : []),
      openRows: new Set(Array.isArray(parsed.openRows) ? parsed.openRows : []),
    };
  } catch {
    return { pinned: new Set(), muted: new Set(), openRows: new Set() };
  }
}
