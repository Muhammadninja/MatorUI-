import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { ApiError } from '@/services/api-client';
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
  /** True when the failure was a network / connection / timeout error
   *  (couldn't reach the server) rather than a server-side error response.
   *  Lets screens degrade offline failures to an empty state instead of a
   *  scary error card. */
  isOffline: boolean;
  /** True while a NEW request (a different sort, filter, or page) is in
   *  flight but the previous result is still on screen. Screens use it to
   *  dim the list instead of tearing it down. A background refetch of the
   *  SAME key doesn't set it — that would flicker on every mount. */
  isRefreshing: boolean;
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
  return [
    'catalog',
    'list',
    req.page,
    req.pageSize,
    req.category,
    req.vehicleCategory,
    req.make,
    req.model,
    req.brand,
    req.regions,
    req.gmOnly,
    req.oemOnly,
    req.search,
    req.sortBy,
  ] as const;
}

export function useCatalogList(request: CatalogListRequest = DEFAULT_REQUEST): UseCatalogListValue {
  const query = useQuery({
    queryKey: catalogListQueryKey(request),
    queryFn: ({ signal }) => fetchCatalogList({ ...request, signal }),
    // Changing the sort changes the query key. Without this, React Query
    // treats it as a first load: `isPending` flips true, the hook reports
    // 'loading', and the screen empties its list and unmounts the very sort
    // row that was just tapped — the rows then jump back in when the response
    // lands. Keeping the previous page makes a re-sort a swap, not a teardown.
    placeholderData: keepPreviousData,
  });

  return useMemo<UseCatalogListValue>(() => {
    const items = query.data?.items ?? [];
    const total = query.data?.total ?? 0;
    let state: CatalogListState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if (items.length === 0) state = 'empty';
    else state = 'success';

    // A connection/timeout failure has no HTTP status (ApiError.status === 0).
    const isOffline = query.error instanceof ApiError && query.error.isNetworkError;

    return {
      state,
      items,
      total,
      isRefreshing: query.isPlaceholderData,
      error: query.error instanceof Error ? query.error.message : null,
      isOffline,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [query]);
}

export default useCatalogList;
