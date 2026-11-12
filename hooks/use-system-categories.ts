import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { fetchRootCategories, type CategoryTileData } from '@/services/categories-service';
import { localizedCategoryLabel } from '@/utils/category-label';

/**
 * "Systems" landing hook — the vehicle-systems list shown after a make/model
 * pick.
 *
 * It browses the CATEGORY-TREE ROOTS (`GET /v1/reference/categories`, no
 * parentId → level-0 systems: Brake System, Engine, … "Другое"), the same nodes
 * the home grid shows (`useCategories`) and the ones an admin manages in the
 * categories console. Here a tap drills — system → subcategories → the parts
 * that fit the chosen model — where the home grid lists a system's parts at
 * once. Presentation and order come from `categories-service`.
 */

export type SystemCategoriesState = 'loading' | 'success' | 'error';

export type UseSystemCategoriesValue = {
  state: SystemCategoriesState;
  categories: CategoryTileData[];
  error: string | null;
  refresh: () => Promise<unknown>;
};

export const SYSTEM_CATEGORIES_QUERY_KEY = ['categories', 'systems'] as const;

export function useSystemCategories(): UseSystemCategoriesValue {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useQuery({
    // The rows carry every language's name, so the key needs no language.
    queryKey: SYSTEM_CATEGORIES_QUERY_KEY,
    queryFn: ({ signal }) => fetchRootCategories('systems', signal),
  });

  return useMemo<UseSystemCategoriesValue>(() => {
    let state: SystemCategoriesState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'success';

    const rows = query.data ?? [];
    const categories = rows.map((c) => ({ ...c, label: localizedCategoryLabel(c, lang) }));

    return {
      state,
      categories,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
    };
  }, [query, lang]);
}
