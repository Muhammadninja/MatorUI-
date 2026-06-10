/**
 * App-wide React Query client. Defaults tuned for a mobile data layer:
 *
 *   - 5-min staleTime — most reads (catalog, orders, top-featured) don't
 *     need to refetch on every screen focus. Hooks can override per-call.
 *   - 15-min gcTime — keep results around so navigating back to a screen
 *     is instant.
 *   - 2 retries on transient failure. Coordinates with apiClient's own
 *     retry (which handles network / 5xx) so a final user-facing failure
 *     happens after the network has been definitively unreliable.
 *   - refetchOnWindowFocus disabled on RN — no real "window focus" on
 *     mobile; use AppState if we want a foreground-refresh story later.
 */

import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/services/api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 4xx (other than 408/429) are caller errors — don't retry.
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408 &&
          error.status !== 429
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      // Mutations are user-initiated and side-effectful — surface failures
      // immediately rather than masking them under a silent retry.
      retry: false,
    },
  },
});
