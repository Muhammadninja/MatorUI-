import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchCategories, type CategoryTileData } from '@/services/categories-service';
import { MATOR_CAT_TILES } from '@/mocks/mator-catalog';

/**
 * "Shop by category" grid hook for the Explore (home) screen, backed by
 * React Query. Same state machine as `useCatalogList`
 * so the landing blocks behave consistently.
 *
 * Resilience: the home grid is the first thing the user sees, so it must never
 * render blank. If the request errors, we fall back to the bundled
 * `MATOR_CAT_TILES` and report `state: 'error'` (callers can still surface a
 * quiet "couldn't refresh" toast) while keeping tiles on screen.
 */

export type CategoriesState = 'loading' | 'success' | 'error';

export type UseCategoriesValue = {
  state: CategoriesState;
  categories: CategoryTileData[];
  error: string | null;
  refresh: () => Promise<unknown>;
};

/** Bundled tiles as the offline / error fallback, in the UI's normalized shape. */
const FALLBACK_TILES: CategoryTileData[] = MATOR_CAT_TILES.map((t) => ({
  id: t.name,
  name: t.name,
  count: t.count,
  color: t.color,
  iconKey: t.name,
}));

export const CATEGORIES_QUERY_KEY = ['categories', 'list'] as const;

export function useCategories(): UseCategoriesValue {
  const query = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: ({ signal }) => fetchCategories(signal),
  });

  return useMemo<UseCategoriesValue>(() => {
    let state: CategoriesState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'success';

    // On error keep tiles visible using the bundled fallback; otherwise use
    // whatever the transport returned (mock or live).
    const categories = query.isError ? FALLBACK_TILES : query.data ?? [];

    return {
      state,
      categories,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
    };
  }, [query]);
}

export default useCategories;
