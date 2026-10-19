import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import {
  fetchCategories,
  type CategoryScope,
  type CategoryTileData,
} from '@/services/categories-service';
import { MATOR_CAT_TILES } from '@/mocks/mator-catalog';
import { localizedCategoryLabel } from '@/utils/category-label';

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
  // Bundled tiles carry a single name, so it doubles as the display label.
  label: t.name,
  count: t.count,
  color: t.color,
  iconKey: t.name,
}));

export const CATEGORIES_QUERY_KEY = ['categories', 'list'] as const;

/**
 * The home grid browses the `main` scope — the 12 designed tiles.
 *
 * Heads-up on today's data: the server reports `count: 0` for 11 of those 12,
 * and `/v1/catalog/parts?category=<tile id>` returns nothing, because parts are
 * filed under leaf categories ("air-filters", "front-brake-pads") that these
 * tiles sit BESIDE rather than above. The fix belongs on the backend — roll
 * descendant parts into each tile's `count`, and make the `category` filter
 * match descendants.
 *
 * Passing `'vehicle'` switches the grid to the 8 vehicle-system buckets, which
 * do carry live counts and whose ids filter the list through
 * `vehicle_category` — a working stand-in if the rollup takes a while.
 */
const DEFAULT_SCOPE: CategoryScope = 'main';

export function useCategories(scope: CategoryScope = DEFAULT_SCOPE): UseCategoriesValue {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const query = useQuery({
    // Language in the key so switching locale refetches with localized labels
    // instead of serving the previous language's cached tiles.
    queryKey: [...CATEGORIES_QUERY_KEY, scope, lang],
    queryFn: ({ signal }) => fetchCategories(scope, signal),
  });

  return useMemo<UseCategoriesValue>(() => {
    let state: CategoriesState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'success';

    // On error keep tiles visible using the bundled fallback; otherwise use
    // whatever the transport returned (mock or live). Either way the label is
    // re-resolved for the active language (see the note above).
    const rows = query.isError ? FALLBACK_TILES : (query.data ?? []);
    // Vehicle-system buckets have no i18n columns on the server (the enum has
    // no translation table), so their display name comes from the app's own
    // catalogue, keyed by the enum id. Everything else keeps the server's
    // localized label; an id we don't carry a translation for falls through to
    // it too, so a new backend bucket still renders text.
    const categories = rows.map((c) => ({
      ...c,
      label:
        t(`category.vehicle.${c.id}`, { defaultValue: '' }).trim() ||
        localizedCategoryLabel(c, lang),
    }));

    return {
      state,
      categories,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
    };
  }, [query, lang, t]);
}

export default useCategories;
