import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchPlacements, type Placement } from '@/services/placements-service';
import { MATOR_CERTIFIED } from '@/mocks/mator-catalog';

/**
 * "MATOR Certified" placement row hook — the sponsored/certified slot on
 * Explore, backed by React Query. Same state machine + resilience as
 * `useCategories`: if the request errors, fall back to the bundled
 * `MATOR_CERTIFIED` seed (and report `state: 'error'`) so the monetizable row
 * never renders blank.
 */

export type PlacementsState = 'loading' | 'success' | 'error';

export type UsePlacementsValue = {
  state: PlacementsState;
  placements: Placement[];
  error: string | null;
  refresh: () => Promise<unknown>;
};

/** Bundled seed as the offline / error fallback. */
const FALLBACK_PLACEMENTS: Placement[] = MATOR_CERTIFIED.map((p) => ({ ...p }));

export const PLACEMENTS_QUERY_KEY = ['placements', 'list'] as const;

export function usePlacements(): UsePlacementsValue {
  const query = useQuery({
    queryKey: PLACEMENTS_QUERY_KEY,
    queryFn: ({ signal }) => fetchPlacements(signal),
  });

  return useMemo<UsePlacementsValue>(() => {
    let state: PlacementsState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'success';

    // On error keep the row visible using the bundled fallback; otherwise use
    // whatever the transport returned (mock or live).
    const placements = query.isError ? FALLBACK_PLACEMENTS : query.data ?? [];

    return {
      state,
      placements,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
    };
  }, [query]);
}

export default usePlacements;
