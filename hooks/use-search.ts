import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSearchVehicleContext } from '@/contexts/active-vehicle.context';
import { searchTransport } from '@/services/search-service';
import type {
  PriceBucket,
  RatingBucket,
  SearchCategoryFacet,
  SearchFilters,
  SearchResponse,
  SearchResult,
  SearchSortBy,
  SearchState,
} from '@/types/search';

// Re-export types from the canonical types module so existing call sites
// that import from this hook keep working.
export type {
  PriceBucket,
  RatingBucket,
  SearchCategoryFacet,
  SearchFilters,
  SearchResult,
  SearchSortBy,
  SearchState,
} from '@/types/search';

/**
 * Universal search hook with debouncing + stale-request cancellation.
 *  - 300ms debounce.
 *  - Cancels stale requests via AbortController.
 *  - Five-state machine for UI rendering.
 *  - Filters travel server-side via the request payload; the response's
 *    `appliedFilters` + `facetCounts` are surfaced back to the UI.
 *  - `didYouMean` exposed for spelling-correction UX.
 *  - `requestId` captured per query for downstream click-tracking.
 *  - Pagination: `loadMore()` appends the next page using
 *    `nextPageToken`; `isLoadingMore` flips while the request is in
 *    flight without leaving the `success` state.
 */

export const DEFAULT_FILTERS: SearchFilters = {
  categories: [],
  price: 'any',
  minRating: 'any',
};

/**
 * Category chips for the filter sheet, in preference order:
 *   1. `categories` — {id, name, count}; the only source with real ids.
 *   2. `facetCounts.categories` — localized keys + counts (legacy).
 *   3. `suggestedCategories` — localized names only (legacy).
 * In the legacy cases the display name has to stand in as the id, which is
 * exactly the round-trip problem the `categories` contract fixes — but it
 * preserves the pre-existing behaviour for transports that haven't caught up.
 */
export function deriveCategoryFacets(response: SearchResponse): SearchCategoryFacet[] {
  if (response.categories?.length) return response.categories;

  const counts = response.facetCounts?.categories;
  if (counts) {
    return Object.entries(counts).map(([name, count]) => ({ id: name, name, count }));
  }
  return (response.suggestedCategories ?? []).map((name) => ({ id: name, name }));
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.categories.length > 0 ||
    filters.price !== 'any' ||
    filters.minRating !== 'any'
  );
}

export type UseSearchValue = {
  query: string;
  setQuery: (query: string | undefined | null) => void;
  state: SearchState;
  results: SearchResult[];
  /** Total matches on the server (NOT page length). */
  total: number;
  durationMs: number | null;
  error: string | null;
  /** Active filter set. Default is everything-off. */
  filters: SearchFilters;
  setFilters: (next: SearchFilters) => void;
  /** Server-suggested category facets (full list): `id` for filtering,
   *  `name` for display. Never key UI state on `name` — it's localized. */
  availableCategories: SearchCategoryFacet[];
  /** Per-bucket counts from the server for the filter sheet. */
  facetCounts: SearchResponse['facetCounts'];
  /** Server-issued correlation id — pass through to analytics events. */
  requestId: string | null;
  /** Spelling/phrasing suggestion the server returned. */
  didYouMean: string | null;
  /** Server's canonical version of the applied filter set. */
  appliedFilters: SearchFilters | null;
  /** Sort key — defaults to relevance. */
  sortBy: SearchSortBy;
  setSortBy: (next: SearchSortBy) => void;
  /** Token for the next page, or null when on the last page. */
  nextPageToken: string | null;
  /** True while a next-page request is in flight. */
  isLoadingMore: boolean;
  /** Load the next page (no-op when there's nothing left). */
  loadMore: () => void;
  /** Immediately re-run the current query, bypassing the debounce. */
  flush: () => void;
};

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function newClientRequestId(): string {
  return `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useSearch(): UseSearchValue {
  const [query, setQueryState] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortByState] = useState<SearchSortBy>('relevance');
  const [facetCounts, setFacetCounts] = useState<SearchResponse['facetCounts']>(undefined);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters | null>(null);
  const [availableCategories, setAvailableCategories] = useState<SearchCategoryFacet[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const liveQueryRef = useRef<string>('');

  // Active-vehicle context auto-attached to every outgoing search.
  // Read through a ref so the run() / loadMore() closures always see
  // the latest scope without re-binding (and without retriggering
  // searches just because the vehicle changed under an empty query).
  const vehicleContext = useSearchVehicleContext();
  const vehicleContextRef = useRef(vehicleContext);
  useEffect(() => {
    vehicleContextRef.current = vehicleContext;
  }, [vehicleContext]);

  // Interface language sent as `SearchRequest.locale`. It takes precedence
  // over `Accept-Language` server-side, which is exactly what we want: the
  // app's chosen language, not the device's. Held in a ref so the runner
  // closures always read the current value (the ref is seeded here; the
  // effect that keeps it current lives below, next to `run`).
  const { i18n } = useTranslation();
  const localeRef = useRef(i18n.language);

  // Keep latest derived values in refs so closures (debounced runner,
  // loadMore) never capture stale values.
  const filtersRef = useRef(filters);
  const sortByRef = useRef(sortBy);
  const nextPageTokenRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);
  useEffect(() => {
    nextPageTokenRef.current = nextPageToken;
  }, [nextPageToken]);
  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  const run = useCallback(async (next: string | undefined | null) => {
    const safe = typeof next === 'string' ? next : '';
    const trimmed = safe.trim();
    liveQueryRef.current = trimmed;

    if (trimmed.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      abortRef.current = null;
      setState('idle');
      setResults([]);
      setTotal(0);
      setError(null);
      setDurationMs(null);
      setFacetCounts(undefined);
      setDidYouMean(null);
      setAppliedFilters(null);
      setAvailableCategories([]);
      setNextPageToken(null);
      setIsLoadingMore(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState('loading');
    setError(null);
    // Reset pagination on any first-page request.
    setNextPageToken(null);
    setIsLoadingMore(false);

    const reqId = newClientRequestId();

    try {
      const response = await searchTransport.search({
        query: trimmed,
        filters: filtersRef.current,
        sortBy: sortByRef.current,
        requestId: reqId,
        locale: localeRef.current,
        vehicleContext: vehicleContextRef.current,
        signal: controller.signal,
      });

      // Late-arrival guard.
      if (liveQueryRef.current !== trimmed) return;

      setRequestId(response.requestId);
      setResults(response.results);
      setTotal(response.total);
      setDurationMs(response.durationMs);
      setFacetCounts(response.facetCounts);
      setDidYouMean(response.didYouMean ?? null);
      setAppliedFilters(response.appliedFilters ?? null);
      // Prefer the `categories` contract — it carries the stable id alongside
      // the localized name. The legacy fallbacks only have display strings, so
      // there the name has to double as the id (which is what the old code
      // did, and what the mock catalog still expects).
      setAvailableCategories(deriveCategoryFacets(response));
      setNextPageToken(response.nextPageToken ?? null);
      setState(response.results.length > 0 ? 'success' : 'empty');
    } catch (err) {
      const isAbort =
        (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');
      if (isAbort) return;
      if (liveQueryRef.current !== trimmed) return;
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      setState('error');
    }
  }, []);

  // A language switch invalidates everything the server localized for us —
  // result rows' `category`, the facet chips' names, `suggestedCategories`.
  // Re-run the live query so they come back in the new language instead of
  // sitting stale until the user next types. Filters are unaffected: they
  // carry ids, so the same selection re-applies verbatim.
  const localeSyncedRef = useRef(true);
  useEffect(() => {
    localeRef.current = i18n.language;
    // Skip the mount pass — there is no query to re-run yet, and the initial
    // search is driven by setQuery.
    if (localeSyncedRef.current) {
      localeSyncedRef.current = false;
      return;
    }
    if (liveQueryRef.current.length >= MIN_QUERY_LENGTH) {
      void run(liveQueryRef.current);
    }
  }, [i18n.language, run]);

  const loadMore = useCallback(async () => {
    const token = nextPageTokenRef.current;
    const trimmed = liveQueryRef.current;
    if (!token) return;
    if (isLoadingMoreRef.current) return;
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    // Use a separate controller so an in-flight loadMore doesn't get killed
    // by the abortRef sweep on the next debounced run() — but we also won't
    // commit its results if the user's query has since moved on.
    const controller = new AbortController();
    setIsLoadingMore(true);

    const reqId = newClientRequestId();
    try {
      const response = await searchTransport.search({
        query: trimmed,
        pageToken: token,
        filters: filtersRef.current,
        sortBy: sortByRef.current,
        requestId: reqId,
        locale: localeRef.current,
        vehicleContext: vehicleContextRef.current,
        signal: controller.signal,
      });

      // Drop the page if the user moved on to a different query.
      if (liveQueryRef.current !== trimmed) return;

      setResults((prev) => {
        // Drop dupes by id in case the server overlaps pages.
        const seen = new Set(prev.map((r) => r.id));
        const merged = [...prev];
        for (const r of response.results) {
          if (!seen.has(r.id)) merged.push(r);
        }
        return merged;
      });
      setTotal(response.total);
      setNextPageToken(response.nextPageToken ?? null);
    } catch (err) {
      const isAbort =
        (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');
      if (isAbort) return;
      // Soft-fail pagination — do NOT flip the screen to 'error'. The user
      // already has page 1; surface via console for now (could become a
      // toast later) and leave the token in place so they can retry.
      if (__DEV__) console.warn('loadMore failed:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  const setQuery = useCallback(
    (next: string | undefined | null) => {
      const safe = typeof next === 'string' ? next : '';
      setQueryState(safe);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void run(safe);
      }, DEBOUNCE_MS);
    },
    [run],
  );

  // When filters or sort change, re-run the current query immediately
  // (no debounce — the user explicitly tapped Apply or changed sort).
  const setFilters = useCallback(
    (next: SearchFilters) => {
      setFiltersState(next);
      filtersRef.current = next;
      if (query.trim().length >= MIN_QUERY_LENGTH) {
        void run(query);
      }
    },
    [query, run],
  );

  const setSortBy = useCallback(
    (next: SearchSortBy) => {
      setSortByState(next);
      sortByRef.current = next;
      if (query.trim().length >= MIN_QUERY_LENGTH) {
        void run(query);
      }
    },
    [query, run],
  );

  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    void run(query);
  }, [query, run]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return useMemo(
    () => ({
      query,
      setQuery,
      state,
      results,
      total,
      durationMs,
      error,
      filters,
      setFilters,
      availableCategories,
      facetCounts,
      requestId,
      didYouMean,
      appliedFilters,
      sortBy,
      setSortBy,
      nextPageToken,
      isLoadingMore,
      loadMore,
      flush,
    }),
    [
      query,
      setQuery,
      state,
      results,
      total,
      durationMs,
      error,
      filters,
      setFilters,
      availableCategories,
      facetCounts,
      requestId,
      didYouMean,
      appliedFilters,
      sortBy,
      setSortBy,
      nextPageToken,
      isLoadingMore,
      loadMore,
      flush,
    ],
  );
}

export default useSearch;
