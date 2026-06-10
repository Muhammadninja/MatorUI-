import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchTopFeaturedList,
  type TopFeaturedAvailableFilterPayload,
  type TopFeaturedItem,
  type TopFeaturedListRequest,
} from '@/services/top-featured-service';

/**
 * Top-featured list hook, backed by React Query. Same five-state
 * machine as `useCatalogList` so both landing-page blocks present
 * consistent affordances to the user.
 */

export type TopFeaturedListState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export type UseTopFeaturedListValue = {
  state: TopFeaturedListState;
  items: TopFeaturedItem[];
  total: number;
  error: string | null;
  /** Backend-supplied available filter set (per the response contract).
   *  Lets the filter sheet show counts and option lists from the server. */
  availableFilters: TopFeaturedAvailableFilterPayload[];
  refresh: () => void;
};

const DEFAULT_REQUEST: TopFeaturedListRequest = {
  page: 1,
  pageSize: 24,
  filters: {},
};

export function topFeaturedListQueryKey(req: TopFeaturedListRequest) {
  // Filters are an object — JSON-stringify them so query-key equality is
  // by value, not by reference.
  return [
    'top-featured',
    'list',
    req.page,
    req.pageSize,
    JSON.stringify(req.filters ?? {}),
    req.search,
    req.sortBy,
  ] as const;
}

export function useTopFeaturedList(
  request: TopFeaturedListRequest = DEFAULT_REQUEST,
): UseTopFeaturedListValue {
  const query = useQuery({
    queryKey: topFeaturedListQueryKey(request),
    queryFn: ({ signal }) => fetchTopFeaturedList({ ...request, signal }),
  });

  return useMemo<UseTopFeaturedListValue>(() => {
    const items = query.data?.items ?? [];
    let state: TopFeaturedListState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if (items.length === 0) state = 'empty';
    else state = 'success';

    return {
      state,
      items,
      total: query.data?.total ?? 0,
      availableFilters: query.data?.availableFilters ?? [],
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [query]);
}

export default useTopFeaturedList;
