import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

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

export function catalogDetailQueryKey(id: string) {
  return ['catalog', 'detail', id] as const;
}

/**
 * Warm a product's detail into the RQ cache so the item-detail screen renders
 * instantly instead of showing a spinner. Fire this on press, just before
 * navigating — the fetch starts during the ~300ms navigation animation, so on a
 * slow connection the data is often already back by the time the screen mounts.
 * No-op when `id` is empty; respects the global `staleTime` (won't refetch fresh
 * data); errors are swallowed since this is a best-effort warm-up, not a load.
 */
export function prefetchCatalogDetail(id: string | null | undefined): void {
  if (!id) return;
  void queryClient.prefetchQuery({
    queryKey: catalogDetailQueryKey(id),
    queryFn: ({ signal }) => fetchCatalogDetail(id, signal),
  });
}

export function useCatalogDetail(id: string | null | undefined): UseCatalogDetailValue {
  const query = useQuery({
    queryKey: id ? catalogDetailQueryKey(id) : ['catalog', 'detail', 'disabled'],
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
