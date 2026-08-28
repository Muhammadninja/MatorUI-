import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import type { CategoryTileData } from '@/services/categories-service';
import { fetchReferenceCategories, localizedCategoryName } from '@/services/reference-catalog';
import { MATOR_CAT_TILES } from '@/mocks/mator-catalog';

/**
 * "Systems" landing hook — the vehicle-systems list shown after a make/model
 * pick (and from Explore's "Browse by system").
 *
 * Unlike the Explore home grid (`useCategories` → GET /v1/categories, the 12
 * mainCategory buckets), this browses the CATEGORY-TREE ROOTS
 * (`GET /v1/reference/categories`, no parentId → level-0 systems: Brake System,
 * Engine, Heating & Cooling…). Those roots are what an admin manages under the
 * categories console AND what the subcategory seed hangs under, so drilling a
 * system here surfaces its admin-defined subcategories.
 *
 * The reference node carries no presentation (`iconKey`/`color`) — that lives
 * only on the buyer-grid endpoint — so we attach it here from ROOT_META, keyed
 * on the stable root id. ROOT_META also supplies the Russian display label and
 * the display order; a root the map doesn't know falls back to its server
 * `name` and is appended after the known ones (so a newly-added system still
 * shows, just unstyled, instead of vanishing).
 */

export type SystemCategoriesState = 'loading' | 'success' | 'error';

export type UseSystemCategoriesValue = {
  state: SystemCategoriesState;
  categories: CategoryTileData[];
  error: string | null;
  refresh: () => Promise<unknown>;
};

/** Root id → display label / icon handle / accent, in intended display order. */
const ROOT_META: Record<string, { label: string; iconKey: string; color: string }> = {
  'brake-system': { label: 'Тормозная система', iconKey: 'brakes', color: '#EA4335' },
  'engine-system': { label: 'Двигатель', iconKey: 'engine', color: '#4285F4' },
  'suspension-and-steering': { label: 'Подвеска и рулевое', iconKey: 'suspension', color: '#009688' },
  transmission: { label: 'Трансмиссия', iconKey: 'transmission', color: '#795548' },
  'heating-and-cooling': { label: 'Отопление и охлаждение', iconKey: 'climate', color: '#00ACC1' },
  'electrical-and-lighting': { label: 'Электрика и свет', iconKey: 'electrical', color: '#A142F4' },
  'maintenance-and-fluids': { label: 'ТО и жидкости', iconKey: 'maintenance', color: '#34A853' },
  'motor-oil': { label: 'Моторные масла', iconKey: 'oil', color: '#F9AB00' },
  'tuning-and-accessories': { label: 'Тюнинг и аксессуары', iconKey: 'tuning', color: '#607D8B' },
  cat_uncategorized: { label: 'Другое', iconKey: 'exterior', color: '#5F6368' },
};
const ROOT_ORDER = Object.keys(ROOT_META);
const DEFAULT_TILE_COLOR = '#4285f4';

/**
 * Roots never shown on the storefront. `cat_uncategorized` is the system fallback
 * bucket parts land in when unclassified — the backend refuses to delete it, and
 * the home grid already hides it, so the systems landing hides it too.
 */
const HIDDEN_ROOTS = new Set<string>(['cat_uncategorized']);

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

async function fetchSystemCategories(lang: string, signal?: AbortSignal): Promise<CategoryTileData[]> {
  const roots = await fetchReferenceCategories(undefined, signal);
  return roots
    .filter((r) => !HIDDEN_ROOTS.has(r.id))
    .map((r) => {
      const meta = ROOT_META[r.id];
      // Prefer the server's localized title (title_ru/title_uz/title_en); fall
      // back to the built-in Russian label for any root not yet translated,
      // then the raw name. This is the *display* string — `name` stays the raw
      // internal one so icon keys and placeholder checks keep matching.
      const label =
        r.titleRu || r.titleUz || r.titleEn
          ? localizedCategoryName(r, lang)
          : meta?.label ?? r.name;
      return {
        id: r.id,
        name: r.name,
        label,
        count: 0, // roots carry no count; the systems rows don't render one
        color: meta?.color ?? DEFAULT_TILE_COLOR,
        iconKey: meta?.iconKey ?? r.slug ?? r.name,
      };
    })
    .sort((a, b) => {
      // Known roots in ROOT_ORDER; unknown roots keep server order after them.
      const ia = ROOT_ORDER.indexOf(a.id);
      const ib = ROOT_ORDER.indexOf(b.id);
      return (ia === -1 ? ROOT_ORDER.length : ia) - (ib === -1 ? ROOT_ORDER.length : ib);
    });
}

export function useSystemCategories(): UseSystemCategoriesValue {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const query = useQuery({
    // Language in the key so switching locale refetches with localized labels.
    queryKey: [...SYSTEM_CATEGORIES_QUERY_KEY, lang],
    queryFn: ({ signal }) => fetchSystemCategories(lang, signal),
  });

  return useMemo<UseSystemCategoriesValue>(() => {
    let state: SystemCategoriesState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'success';

    // On mock/offline builds the reference fetcher returns [] (state 'success',
    // empty). Keep the landing populated by falling back to the bundled buckets
    // there and on outright error, mirroring the home grid's resilience.
    const live = query.data ?? [];
    const categories = query.isError || (state === 'success' && live.length === 0) ? FALLBACK_TILES : live;

    return {
      state,
      categories,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
    };
  }, [query]);
}
