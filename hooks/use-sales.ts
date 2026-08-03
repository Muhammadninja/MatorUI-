import { useQuery } from '@tanstack/react-query';

import { fetchSales, type Sale } from '@/services/sales-service';

/**
 * Active discount campaigns (`GET /v1/sales`), backed by React Query. Every
 * product row calls this to resolve its own "-15%" pill; React Query dedupes
 * the request so the whole list shares one fetch.
 *
 * Sales change on the scale of days, so the list is cached generously and a
 * fetch error falls back to "no active sales" (empty array) — a missing pill is
 * the correct degradation, never a crash or a stale/fake discount.
 */
export const SALES_QUERY_KEY = ['sales', 'active'] as const;

/** How long fetched sales stay fresh — they turn over slowly. */
const SALES_STALE_MS = 5 * 60 * 1000;

export function useActiveSales(): Sale[] {
  const query = useQuery({
    queryKey: SALES_QUERY_KEY,
    queryFn: ({ signal }) => fetchSales(signal),
    staleTime: SALES_STALE_MS,
  });
  return query.data ?? [];
}

export default useActiveSales;
