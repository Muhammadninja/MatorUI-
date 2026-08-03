import { useQuery } from '@tanstack/react-query';

import {
  fetchEngines,
  fetchMakes,
  fetchModels,
  fetchTrims,
  type RefEngine,
  type RefMake,
  type RefModel,
  type RefTrim,
} from '@/services/reference-catalog';

/**
 * Cascading vehicle reference-catalog hooks for the Add-Vehicle flow.
 *
 * Each level is enabled only once its parent id is chosen, so React Query
 * fires exactly the requests the cascade needs (make → model → trim →
 * engine) and caches each list. The catalog is effectively static, so we
 * hold it fresh for an hour to avoid refetch churn as the user steps back
 * and forth through the pickers.
 */

const STALE_MS = 60 * 60 * 1000; // 1h — reference tables rarely change

export function useMakes() {
  return useQuery<RefMake[]>({
    queryKey: ['reference', 'makes'],
    queryFn: ({ signal }) => fetchMakes(signal),
    staleTime: STALE_MS,
  });
}

export function useModels(makeId: string | null | undefined) {
  return useQuery<RefModel[]>({
    queryKey: makeId ? ['reference', 'models', makeId] : ['reference', 'models', 'disabled'],
    queryFn: ({ signal }) => fetchModels(makeId as string, signal),
    enabled: !!makeId,
    staleTime: STALE_MS,
  });
}

export function useTrims(modelId: string | null | undefined) {
  return useQuery<RefTrim[]>({
    queryKey: modelId ? ['reference', 'trims', modelId] : ['reference', 'trims', 'disabled'],
    queryFn: ({ signal }) => fetchTrims(modelId as string, signal),
    enabled: !!modelId,
    staleTime: STALE_MS,
  });
}

export function useEngines(trimId: string | null | undefined) {
  return useQuery<RefEngine[]>({
    queryKey: trimId ? ['reference', 'engines', trimId] : ['reference', 'engines', 'disabled'],
    queryFn: ({ signal }) => fetchEngines(trimId as string, signal),
    enabled: !!trimId,
    staleTime: STALE_MS,
  });
}
