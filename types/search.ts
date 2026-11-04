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

/**
 * Server-driven accent-tag kind. The client maps each kind to its label
 * + icon through the registry in `signal.ts` — kind is the contract,
 * the display is an implementation detail.
 */
export type AccentTagKind = 'lowest_price' | 'bestseller';

export type SearchResult = {
  id: string;
  title: string;
  description: string;
  /**
   * Display-formatted UZS price ("UZS 369 000"). Live search supplies this
   * string rounded to whole som, not a numeric amount; the transport replaces
   * it with the catalog's exact amount when that part is on the catalog page.
   */
  price: string;
  priceLabel: string;
  /** Legacy minor-unit field: the mock uses tiyin (UZS × 100).
   * Absent from the current live response; never interpret as whole UZS. */
  priceCents?: number;
  /**
   * Product photos, most representative first. The row renders `images[0]`
   * and falls back to the no-photo placeholder when the array is empty, so a
   * part with no uploaded photo is visibly different from one that has one.
   * Wire: `images` (also accepted: `image_url` / `imageUrl` singular).
   */
  images?: string[];
  /** OEM part number, when the part carries one. */
  oem?: string;
  /** GM cross-reference number, when the part carries one. */
  gm?: string;
  /** Localized category display name — render only, never an identifier. */
  category: string;
  /** Stable category id (wire: `category_id`). Use this for filters, deep
   *  links and analytics. Absent on transports that don't emit it. */
  categoryId?: string;
  /**
   * Free-text editorial badge from the backend ("Top", "New", "Hot pick").
   * Renders as the standalone single-signal ribbon when no higher
   * priority signal fires. Keep server-supplied strings short.
   */
  badge?: string;
  /**
   * Trust/quality accent tag (Bestseller / Mator Verified / Lowest price /
   * Editor's pick). Server-driven, enum-typed so the client owns
   * label + icon. When absent, client may fall back to its mock
   * hash-derivation during the transition.
   */
  accentTagKind?: AccentTagKind;
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

/**
 * One category facet from `/v1/search`. The split is the whole point:
 * `id` travels in requests (`filters.categories`), `name` is display text
 * that changes with the request language and must never be used as a key.
 */
export type SearchCategoryFacet = {
  /** Stable identifier — filters, cache keys, persisted state. */
  id: string;
  /** Localized display name — render only. */
  name: string;
  count?: number;
};

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
  /** Category facets — the preferred contract. `id` is the stable identifier
   *  (send this in `filters.categories`); `name` is the localized display
   *  string (render this). Ordered by count desc. Absent on transports that
   *  only emit the legacy facet map. */
  categories?: SearchCategoryFacet[];
  /** Per-bucket counts so the filter sheet can show "(3)" next to each.
   *  LEGACY for categories: the keys are localized display strings, so they
   *  are NOT identifiers. Kept for count lookup and older transports. */
  facetCounts?: {
    categories?: Record<string, number>;
    price?: Partial<Record<PriceBucket, number>>;
    minRating?: Partial<Record<RatingBucket, number>>;
  };
  /** Server-canonicalized filters (after parsing/expansion). UI should
   *  trust these over the request `filters`. */
  appliedFilters?: SearchFilters;
  /** Server-suggested category facets, localized display strings (when no
   *  `categories` array is available). Display only — never identifiers. */
  suggestedCategories?: string[];
  /** Milliseconds the server took. Dev-only UI; never expose in prod. */
  durationMs: number;
};

/**
 * Vehicle-scoping payload appended to every parts-search request when
 * the user has an active vehicle set in `ActiveVehicleProvider`.
 * Server uses this to:
 *   - narrow OEM lookup to `oem_catalog_scope` (a part-family subset)
 *   - filter generation-specific parts via `vehicle_generation`
 *   - bias relevance toward the matching `engine_type` when present
 * Optional fields are omitted (not nulled) so the backend widens its
 * query when the user hasn't disambiguated to that depth.
 */
export type SearchVehicleContext = {
  brand: string;
  model: string;
  vehicle_generation?: string;
  engine_type?: string;
  oem_catalog_scope?: string;
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
  /** BCP-47 locale ('en-US') or a bare code ('uz'). Server uses it for
   *  currency, units and language; it takes precedence over the
   *  `Accept-Language` header, so send the APP's interface language. */
  locale?: string;
  /** Anonymous or authenticated user id for personalization. */
  userId?: string;
  /** A/B test variant the client is on; logged for analysis. */
  abVariant?: string;
  /** Vehicle-scoping context (see SearchVehicleContext). Auto-attached
   *  by `useSearch` when an active vehicle is set. */
  vehicleContext?: SearchVehicleContext;
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
