import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { ApiError } from '@/services/api-client';
import {
  fetchCatalogList,
  type CatalogBrandFacet,
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
    req.brands,
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

/** Rows per page of a scrolled catalogue list. */
export const CATALOG_PAGE_SIZE = 24;

/** A scrolled catalogue list: the request without its page — the hook pages. */
export type CatalogBrowseRequest = Omit<CatalogListRequest, 'page' | 'signal'>;

export type UseCatalogInfiniteListValue = UseCatalogListValue & {
  /** The part brands the whole result offers, each with its count — the
   *  server's, so a brand found only on pages not loaded yet is here too. */
  brandFacets: CatalogBrandFacet[];
  /** The server has rows past the loaded ones. */
  hasMore: boolean;
  /** The next page is in flight — the list's footer spinner. */
  isLoadingMore: boolean;
  /** The last next-page request failed. The loaded rows stay; scrolling stops
   *  asking for more until `retryLoadMore`. */
  loadMoreError: boolean;
  /** Ask for the next page — wire to the list's `onEndReached`. A no-op while
   *  any request for this list is in flight (a new query's first page among
   *  them, so the previous query's dimmed rows never page), after the last
   *  page, and after a failed next page. */
  loadMore: () => void;
  /** Ask again for the next page that failed. */
  retryLoadMore: () => void;
};

/** The React Query key of a scrolled list. Every request field is in it, so
 *  changing any — category, model, search, brands, a filter, the sort — is a
 *  new list that starts again from page 1, and a late answer for the old one
 *  lands in the old one's cache entry, never in the new list. */
export function catalogBrowseQueryKey(req: CatalogBrowseRequest) {
  return ['catalog', 'browse', req] as const;
}

/**
 * `useCatalogList` for a list the shopper scrolls through: page 1 first, then
 * each next page appended as `loadMore` asks for it (`GET /v1/catalog/parts`
 * pages by `page`/`page_size` and answers `next_page`), until the last.
 *
 * `items` is every loaded page in order, each part once: pages cut by offset
 * can overlap when the catalogue moves between two requests (a part listed
 * meanwhile pushes page 1's last row onto page 2), and the first sighting
 * wins. `total` is the server's count for the whole query, never the number
 * loaded.
 */
export function useCatalogInfiniteList(request: CatalogBrowseRequest): UseCatalogInfiniteListValue {
  const query = useInfiniteQuery({
    queryKey: catalogBrowseQueryKey(request),
    queryFn: ({ pageParam, signal }) => fetchCatalogList({ ...request, page: pageParam, signal }),
    initialPageParam: 1,
    // An empty page ends the list whatever `next_page` says: the total can
    // drift in a live catalogue, and asking again would never stop.
    getNextPageParam: (last) => (last.items.length > 0 ? (last.nextPage ?? undefined) : undefined),
    // As in useCatalogList: a new sort or filter dims the old rows until the
    // new first page lands, rather than tearing the list down.
    placeholderData: keepPreviousData,
  });

  const pages = query.data?.pages;
  // Memoized on the pages, not the render: the list re-arms `onEndReached`
  // whenever its data changes identity.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: CatalogItem[] = [];
    for (const page of pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }, [pages]);

  return useMemo<UseCatalogInfiniteListValue>(() => {
    let state: CatalogListState;
    // Rows on screen win over a failure: a failed next page (or background
    // refetch) keeps what was loaded.
    if (items.length > 0) state = 'success';
    else if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'empty';

    const hasMore = query.hasNextPage;
    const loadMoreError = query.isFetchNextPageError;
    // One request at a time per list. `cancelRefetch: false` also makes React
    // Query hand a second call the request already in flight.
    const canFetchNext = hasMore && !query.isFetching;
    const fetchNext = () => {
      void query.fetchNextPage({ cancelRefetch: false });
    };

    return {
      state,
      items,
      // The newest page's count: the catalogue may have moved since page 1.
      total: pages?.[pages.length - 1]?.total ?? 0,
      // The newest page's brands, for the same reason.
      brandFacets: pages?.[pages.length - 1]?.brandFacets ?? [],
      isRefreshing: query.isPlaceholderData,
      error: query.error instanceof Error ? query.error.message : null,
      isOffline: query.error instanceof ApiError && query.error.isNetworkError,
      refresh: () => {
        void query.refetch();
      },
      hasMore,
      isLoadingMore: query.isFetchingNextPage,
      loadMoreError,
      loadMore: () => {
        if (canFetchNext && !loadMoreError) fetchNext();
      },
      retryLoadMore: () => {
        if (canFetchNext) fetchNext();
      },
    };
  }, [query, items, pages]);
}

export default useCatalogList;
