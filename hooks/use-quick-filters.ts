import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchQuickFilters,
  QUICK_FILTERS_SEED,
  type QuickFilterItem,
  type QuickFiltersListRequest,
} from '@/services/quick-filters-service';

/**
 * Quick-filter chip row hook — same five-state machine as
 * `useCatalogList` / `useTopFeaturedList`, with two integration-mode
 * niceties:
 *
 *   1. `items` is ALWAYS a non-empty array. When the API is still
 *      loading, has errored, or has returned zero items, we fall back
 *      to the seed list bundled with the service so the chip row never
 *      blanks out on first paint or after a network blip.
 *   2. `state` still surfaces the underlying query state so the parent
 *      can opt into a skeleton / error toast / retry button when it
 *      wants. By default the explore landing just renders `items` and
 *      ignores `state`.
 *
 * Cache: takes part in the app-wide React Query cache (5-min stale,
 * 15-min gc — see `services/query-client.ts`). The chip row rarely
 * changes within a session, so this matches the read pattern well.
 */

export type QuickFiltersState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export type UseQuickFiltersValue = {
  state: QuickFiltersState;
  /** Effective list rendered by the UI — API items when available,
   *  otherwise the seed fallback. Guaranteed non-empty. */
  items: QuickFilterItem[];
  /** True when the items are the seed fallback (loading / error /
   *  empty response). Lets a consumer dim the row or skip analytics
   *  events for fallback taps if it cares. */
  isFallback: boolean;
  error: string | null;
  refresh: () => void;
};

const DEFAULT_REQUEST: QuickFiltersListRequest = {};

export function quickFiltersQueryKey(req: QuickFiltersListRequest) {
  return ['search', 'quick-filters', req.locale ?? 'default', req.limit ?? null] as const;
}

export function useQuickFilters(
  request: QuickFiltersListRequest = DEFAULT_REQUEST,
): UseQuickFiltersValue {
  const query = useQuery({
    queryKey: quickFiltersQueryKey(request),
    queryFn: ({ signal }) => fetchQuickFilters({ ...request, signal }),
  });

  return useMemo<UseQuickFiltersValue>(() => {
    const apiItems = query.data?.items ?? [];
    let state: QuickFiltersState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if (apiItems.length === 0) state = 'empty';
    else state = 'success';

    const items = state === 'success' ? apiItems : QUICK_FILTERS_SEED;

    return {
      state,
      items,
      isFallback: state !== 'success',
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [query]);
}

export default useQuickFilters;
