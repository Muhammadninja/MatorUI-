import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchQuickFilters,
  type QuickFilterItem,
  type QuickFiltersListRequest,
} from '@/services/quick-filters-service';

/** Only real server data is shown, including cached data after a refetch failure. */

export type QuickFiltersState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export type UseQuickFiltersValue = {
  state: QuickFiltersState;
  /** Effective list rendered by the UI — API items when available,
   *  otherwise an empty array. */
  items: QuickFilterItem[];
  /** Kept for caller compatibility; synthetic fallback data is never shown. */
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

    const items = apiItems;

    return {
      state,
      items,
      isFallback: false,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [query]);
}

export default useQuickFilters;
