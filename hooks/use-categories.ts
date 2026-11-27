import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
 * Each tile carries its root's parts count, served on the same response
 * (`productsCount`); a backend without it leaves the tiles with no count line.
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

/**
 * Keep a home tile's count equal to the listing it opens. The tiles are cached
 * for minutes while a category's list is fetched fresh, so while the catalog
 * changes the two drifted apart (64 on the tile, 65 inside). The listing's
 * total is the one number: once it has loaded, the cached tile takes it.
 * `total` is only trusted when `ready` (the list answered).
 */
export function useSyncCategoryTileCount(
  categoryId: string | undefined,
  total: number,
  ready: boolean,
): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!categoryId || !ready) return;
    queryClient.setQueryData<CategoryTileData[]>(CATEGORIES_QUERY_KEY, (rows) => {
      if (!rows?.some((r) => r.id === categoryId && r.count !== undefined && r.count !== total)) return rows;
      return rows.map((r) => (r.id === categoryId && r.count !== undefined ? { ...r, count: total } : r));
    });
  }, [categoryId, total, ready, queryClient]);
}

export default useCategories;
