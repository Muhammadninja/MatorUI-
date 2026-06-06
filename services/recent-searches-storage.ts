import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence for the "recent searches" list shown under the search bar
 * when it's focused with an empty query. Cap is intentionally small —
 * the panel only renders ~5 rows.
 */

const STORAGE_KEY = 'recent_searches:v1';
const MAX_RECENT = 8;

export type StoredRecentSearches = {
  queries: string[];
};

type Envelope = StoredRecentSearches & { v: 1 };

export async function loadRecentSearches(): Promise<StoredRecentSearches | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Envelope>;
    if (parsed.v !== 1 || !Array.isArray(parsed.queries)) return null;
    return {
      queries: parsed.queries
        .filter((q): q is string => typeof q === 'string')
        .slice(0, MAX_RECENT),
    };
  } catch {
    return null;
  }
}

export async function saveRecentSearches(state: StoredRecentSearches): Promise<void> {
  try {
    const envelope: Envelope = {
      v: 1,
      queries: state.queries.slice(0, MAX_RECENT),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // silent — recents are nice-to-have, not load-bearing.
  }
}

/**
 * Push a new query onto the recents list (most-recent-first). De-dupes
 * by case-insensitive trimmed match and caps the list at MAX_RECENT.
 * Pure — call from a reducer/hook, not the storage layer directly.
 */
export function pushRecentSearch(prev: string[], next: string): string[] {
  const cleaned = next.trim();
  if (cleaned.length === 0) return prev;
  const key = cleaned.toLowerCase();
  // Already at the top with the same casing? Bail out with the SAME
  // reference so React's setState fast-path can drop the update entirely.
  // Without this, every effect-driven add() returns a fresh array even
  // when content is identical, which can chain into a re-render loop if
  // any consumer depends on the resulting queries array identity.
  if (prev.length > 0 && prev[0] === cleaned) return prev;
  const filtered = prev.filter((q) => q.trim().toLowerCase() !== key);
  return [cleaned, ...filtered].slice(0, MAX_RECENT);
}

export { MAX_RECENT };
