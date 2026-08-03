import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchMakes,
  fetchModels,
  type RefMake,
  type RefModel,
} from '@/services/reference-catalog';

/**
 * Vehicle-catalog hooks for the buyer app's brand/model browsing (Explore's
 * "Shop by vehicle" row and the Make screen), backed by React Query over the
 * live `/v1/reference` endpoints — the same makes/models an operator edits in
 * the admin console. Adding a brand or model in admin therefore shows up here.
 *
 * Same state machine as {@link useCategories}. Resilience is built into the
 * `reference-catalog` fetchers: offline / non-HTTP builds and network failures
 * fall back to the bundled `uz-vehicle-catalog`, so these lists never render
 * blank and `state` is 'success' with local data rather than 'error'.
 */

export type VehicleCatalogState = 'loading' | 'success' | 'error';

export const MAKES_QUERY_KEY = ['reference', 'makes'] as const;
export const modelsQueryKey = (makeId: string) =>
  ['reference', 'models', makeId] as const;

export type UseMakesValue = {
  state: VehicleCatalogState;
  makes: RefMake[];
  error: string | null;
  refresh: () => Promise<unknown>;
};

export function useMakes(): UseMakesValue {
  const query = useQuery({
    queryKey: MAKES_QUERY_KEY,
    queryFn: ({ signal }) => fetchMakes(signal),
  });

  return useMemo<UseMakesValue>(() => {
    let state: VehicleCatalogState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'success';

    return {
      state,
      makes: query.data ?? [],
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
    };
  }, [query]);
}

export type UseModelsValue = {
  state: VehicleCatalogState;
  models: RefModel[];
  error: string | null;
  refresh: () => Promise<unknown>;
};

export function useModels(makeId?: string): UseModelsValue {
  const enabled = !!makeId;
  const query = useQuery({
    queryKey: modelsQueryKey(makeId ?? ''),
    queryFn: ({ signal }) => fetchModels(makeId as string, signal),
    enabled,
  });

  return useMemo<UseModelsValue>(() => {
    let state: VehicleCatalogState;
    // A disabled query (no makeId yet) stays pending; treat it as loading.
    if (!enabled || query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'success';

    return {
      state,
      models: query.data ?? [],
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
    };
  }, [enabled, query]);
}
