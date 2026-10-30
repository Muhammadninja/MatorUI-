import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { fetchRootCategories, type CategoryTileData } from '@/services/categories-service';
import { MATOR_CAT_TILES } from '@/mocks/mator-catalog';
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

/** Bundled buckets as the offline / error fallback so the list never renders blank. */
const FALLBACK_TILES: CategoryTileData[] = MATOR_CAT_TILES.map((t) => ({
  id: t.name,
  name: t.name,
  // Bundled tiles carry a single name, so it doubles as the display label.
  label: t.name,
  count: t.count,
  color: t.color,
  iconKey: t.name,
}));

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

    // On mock/offline builds the reference fetcher returns [] (state 'success',
    // empty). Keep the landing populated by falling back to the bundled buckets
    // there and on outright error.
    const live = query.data ?? [];
    const rows =
      query.isError || (state === 'success' && live.length === 0) ? FALLBACK_TILES : live;
    const categories = rows.map((c) => ({ ...c, label: localizedCategoryLabel(c, lang) }));

    return {
      state,
      categories,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
    };
  }, [query, lang]);
}
