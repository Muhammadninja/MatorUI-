import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { fetchRootCategories, type CategoryTileData } from '@/services/categories-service';
import { localizedCategoryLabel } from '@/utils/category-label';

export type CategoriesState = 'loading' | 'success' | 'error';

export type UseCategoriesValue = {
  state: CategoriesState;
  categories: CategoryTileData[];
  error: string | null;
  refresh: () => Promise<unknown>;
};

export const CATEGORIES_QUERY_KEY = ['categories', 'list'] as const;

/**
 * The home "Shop by category" grid — the ROOTS of the category tree (Brake
 * System, Motor Oils, … Other), exactly as the backend serves them. A tile's id
 * is the root's id; a tap lists every part of that root
 * (`/v1/catalog/parts?category=<id>`, which the backend widens to the root's
 * whole subtree).
 *
 * Roots carry no parts count, so the tiles show none.
 */
export function useCategories(): UseCategoriesValue {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useQuery({
    // The tiles carry every language's name, so the key needs no language: a
    // switch re-resolves the labels below without a refetch.
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: ({ signal }) => fetchRootCategories('home', signal),
  });

  return useMemo<UseCategoriesValue>(() => {
    const rows = query.data ?? [];
    let state: CategoriesState;
    if (query.isPending) state = 'loading';
    // The reference fetcher answers a failed read (and a mock/offline build)
    // with []; a tree always has roots, so an empty answer is a failed load.
    else if (query.isError || rows.length === 0) state = 'error';
    else state = 'success';

    return {
      state,
      categories: rows.map((c) => ({ ...c, label: localizedCategoryLabel(c, lang) })),
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
    };
  }, [query, lang]);
}

export default useCategories;
