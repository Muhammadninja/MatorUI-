import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  loadRecentSearches,
  pushRecentSearch,
  saveRecentSearches,
} from '@/services/recent-searches-storage';

/**
 * Recent-searches list — persisted via AsyncStorage. `add()` is called
 * with the query the user actually committed to (full search ran, not
 * just typed). `isHydrated` lets the UI skip rendering the panel until
 * we know the real list, avoiding a flash of "no recents" → recents.
 */

export type UseRecentSearchesValue = {
  queries: string[];
  isHydrated: boolean;
  add: (query: string) => void;
  remove: (query: string) => void;
  clear: () => void;
};

export function useRecentSearches(): UseRecentSearchesValue {
  const [queries, setQueries] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Avoid persisting back during the initial hydrate.
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadRecentSearches();
      if (cancelled) return;
      if (loaded) setQueries(loaded.queries);
      setIsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    void saveRecentSearches({ queries });
  }, [queries, isHydrated]);

  const add = useCallback((query: string) => {
    setQueries((prev) => pushRecentSearch(prev, query));
  }, []);

  const remove = useCallback((query: string) => {
    const key = query.trim().toLowerCase();
    setQueries((prev) => prev.filter((q) => q.trim().toLowerCase() !== key));
  }, []);

  const clear = useCallback(() => {
    setQueries([]);
  }, []);

  // Memoize the returned object so consumers that depend on `recents` as
  // a whole (in deps arrays, props, etc.) don't see a fresh identity on
  // every render — only when its content actually changes.
  return useMemo(
    () => ({ queries, isHydrated, add, remove, clear }),
    [queries, isHydrated, add, remove, clear],
  );
}

export default useRecentSearches;
