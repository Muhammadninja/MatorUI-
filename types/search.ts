/**
 * Shared search types — kept transport-agnostic so UI components and
 * hooks can import them without depending on a concrete service or
 * fetcher. The mock + (future) HTTP transports both produce these
 * shapes; the components only read these types.
 *
 * Designed for a "smart search" backend: filters + sort travel server-
 * side, server returns did-you-mean / facet counts / suggested
 * refinements / request id for telemetry. The client still has the
 * option to filter locally as a fallback when those server fields are
 * absent (e.g. during the mock → HTTP cutover).
 */

// ── Result + response ────────────────────────────────────────────────

export type SearchResult = {
  id: string;
  title: string;
  description: string;
  /**
   * Display-formatted price string ("$26,750"). Kept for UI back-compat;
   * new code should prefer `priceCents` since it's not localized.
   */
  price: string;
  priceLabel: string;
  /** Authoritative numeric price in cents. Server-issued. Filterable. */
  priceCents?: number;
  category: string;
  badge?: string;
  status?: string;
  /** Average rating 0–5 (numeric — replaces the deterministic mock). */
  rating?: number;
  reviewCount?: number;
  /** Server-side relevance rank 0..1. */
  score: number;
  /**
   * Optional explanation chunk for debugging or for surfacing a
   * "Why this result?" affordance in the UI.
   */
  explanation?: string;
};

export type SearchSortBy = 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';

export type SearchResponse = {
  /** Echo of the query the server actually used (post normalization). */
  query: string;
  /** Server-issued request id; echo back in click-tracking events. */
  requestId: string;
  results: SearchResult[];
  /** Total matching items on the server, NOT the page length. */
  total: number;
  /** Page token to pass back as `pageToken` for the next page. */
  nextPageToken?: string;
  /** Spelling / phrasing correction the server suggests. */
  didYouMean?: string;
  /** Refinement chips ("Show only AWD", "Under $30k", …). */
  suggestedRefinements?: { label: string; filterPatch: Partial<SearchFilters> }[];
  /** Per-bucket counts so the filter sheet can show "(3)" next to each. */
  facetCounts?: {
    categories?: Record<string, number>;
    price?: Partial<Record<PriceBucket, number>>;
    minRating?: Partial<Record<RatingBucket, number>>;
  };
  /** Server-canonicalized filters (after parsing/expansion). UI should
   *  trust these over the request `filters`. */
  appliedFilters?: SearchFilters;
  /** Server-suggested category facets (when no facetCounts available). */
  suggestedCategories?: string[];
  /** Milliseconds the server took. Dev-only UI; never expose in prod. */
  durationMs: number;
};

export type SearchRequest = {
  query: string;
  /** Page size cap. */
  limit?: number;
  /** Cursor token from a prior response's `nextPageToken`. */
  pageToken?: string;
  /** Filters applied server-side. */
  filters?: SearchFilters;
  /** Sort key. Default 'relevance'. */
  sortBy?: SearchSortBy;
  /** Client-issued correlation id, echoed back as `response.requestId`. */
  requestId?: string;
  /** BCP-47 locale ('en-US'). Server uses for currency, units, language. */
  locale?: string;
  /** Anonymous or authenticated user id for personalization. */
  userId?: string;
  /** A/B test variant the client is on; logged for analysis. */
  abVariant?: string;
  signal?: AbortSignal;
};

export type TypeaheadRequest = {
  prefix: string;
  limit?: number;
  signal?: AbortSignal;
};

export type TypeaheadSuggestion = {
  text: string;
  /** 'query' = textual suggestion. 'product' = direct deep-link. */
  kind: 'query' | 'product';
  productId?: string;
};

export type TypeaheadResponse = {
  prefix: string;
  suggestions: TypeaheadSuggestion[];
};

// ── Client state ─────────────────────────────────────────────────────

export type SearchState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export type PriceBucket = 'any' | 'under_1k' | '1k_to_10k' | 'over_10k';
export type RatingBucket = 'any' | '3_plus' | '4_plus';

export type SearchFilters = {
  categories: string[];
  price: PriceBucket;
  minRating: RatingBucket;
};
