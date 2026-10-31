import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import i18n from '@/services/i18n';
import {
  fetchCatalogDetail,
  type CatalogDetailResponse,
} from '@/services/catalog-service';
import { queryClient } from '@/services/query-client';

/**
 * Catalog detail hook — single product by id, backed by React Query.
 *
 * Adds a `'not_found'` state on top of RQ's defaults because the detail
 * endpoint can succeed (200) with a null body (id doesn't exist) — a
 * UI-distinct state from a transport failure.
 *
 * When `id` is null/undefined the query is disabled and the hook stays
 * in `'idle'` — useful when router params haven't resolved yet.
 */

export type CatalogDetailState = 'idle' | 'loading' | 'success' | 'not_found' | 'error';

export type UseCatalogDetailValue = {
  state: CatalogDetailState;
  detail: CatalogDetailResponse | null;
  error: string | null;
  refresh: () => void;
};

/**
 * Keyed by language too: `mapPartToCatalogItem` bakes localized text (specs
 * labels, derived category/origin names) into the cached item at fetch time,
 * so without the language in the key, a product fetched under one language
 * would keep showing that language's spec table forever — a switch re-renders
 * every `t()` call live, but never touches already-cached data. Keying by
 * language makes a switch a normal RQ cache miss instead, the same fix
 * `use-categories.ts` already applies to the home category grid.
 */
export function catalogDetailQueryKey(id: string, lang: string) {
  return ['catalog', 'detail', id, lang] as const;
}

/**
 * Warm a product's detail into the RQ cache so the item-detail screen renders
 * instantly instead of showing a spinner. Fire this on press, just before
 * navigating — the fetch starts during the ~300ms navigation animation, so on a
 * slow connection the data is often already back by the time the screen mounts.
 * No-op when `id` is empty; respects the global `staleTime` (won't refetch fresh
 * data); errors are swallowed since this is a best-effort warm-up, not a load.
 * Fired from a press handler outside React, so it reads `i18n.language`
 * directly rather than through `useTranslation`.
 */
export function prefetchCatalogDetail(id: string | null | undefined): void {
  if (!id) return;
  void queryClient.prefetchQuery({
    queryKey: catalogDetailQueryKey(id, i18n.language),
    queryFn: ({ signal }) => fetchCatalogDetail(id, signal),
  });
}

export function useCatalogDetail(id: string | null | undefined): UseCatalogDetailValue {
  const { i18n: i18nInstance } = useTranslation();
  const lang = i18nInstance.language;
  const query = useQuery({
    queryKey: id ? catalogDetailQueryKey(id, lang) : ['catalog', 'detail', 'disabled', lang],
    queryFn: ({ signal }) => fetchCatalogDetail(id as string, signal),
    enabled: !!id,
  });

  return useMemo<UseCatalogDetailValue>(() => {
    let state: CatalogDetailState;
    if (!id) state = 'idle';
    else if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if (query.data === null) state = 'not_found';
    else state = 'success';

    return {
      state,
      detail: query.data ?? null,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [id, query]);
}

export default useCatalogDetail;
