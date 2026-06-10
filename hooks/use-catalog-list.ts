import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchCatalogList,
  type CatalogItem,
  type CatalogListRequest,
} from '@/services/catalog-service';

/**
 * Catalog list hook — backed by React Query so caching, retries,
 * cancellation, and refetch-on-mount are inherited from the global
 * QueryClient config (see services/query-client.ts).
 *
 * Consumers render four states based on `state`:
 *   - 'idle'    — query disabled (never returned today; here for parity
 *                 with the previous hook signature).
 *   - 'loading' — first fetch in flight (show skeleton).
 *   - 'success' — got items back; `items.length > 0`.
 *   - 'empty'   — successful response with zero items.
 *   - 'error'   — fetch threw; `error` is the message.
 */

export type CatalogListState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export type UseCatalogListValue = {
  state: CatalogListState;
  items: CatalogItem[];
  total: number;
  error: string | null;
  /** Re-fire the request — invalidates the cache + refetches. */
  refresh: () => void;
};

const DEFAULT_REQUEST: CatalogListRequest = {
  page: 1,
  pageSize: 20,
};

/** Build the React Query key for a catalog list request. Exported so
 *  mutations elsewhere can invalidate a specific list. */
export function catalogListQueryKey(req: CatalogListRequest) {
  return ['catalog', 'list', req.page, req.pageSize, req.category, req.search, req.sortBy] as const;
}

export function useCatalogList(
  request: CatalogListRequest = DEFAULT_REQUEST,
): UseCatalogListValue {
  const query = useQuery({
    queryKey: catalogListQueryKey(request),
    queryFn: ({ signal }) => fetchCatalogList({ ...request, signal }),
  });

  return useMemo<UseCatalogListValue>(() => {
    const items = query.data?.items ?? [];
    const total = query.data?.total ?? 0;
    let state: CatalogListState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if (items.length === 0) state = 'empty';
    else state = 'success';

    return {
      state,
      items,
      total,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [query]);
}

export default useCatalogList;
