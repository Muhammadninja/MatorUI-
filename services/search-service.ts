import { resolvePartNumber } from '@/services/catalog-service';
import { formatSomAmount } from '@/utils/format-price';
import { normalizePartTitle } from '@/utils/part-title';
import type {
  SearchCategoryFacet,
  SearchRequest,
  SearchResponse,
  SearchResult,
  TypeaheadRequest,
  TypeaheadResponse,
} from '@/types/search';

/**
 * Universal search across the marketplace.
 *
 * Hits `POST /v1/search`. Components depend on the shapes in `types/search.ts`,
 * never on this module's concrete classes.
 */

export type {
  SearchRequest,
  SearchResponse,
  SearchResult,
  TypeaheadRequest,
  TypeaheadResponse,
} from '@/types/search';

export interface SearchTransport {
  /** Full search. */
  search(request: SearchRequest): Promise<SearchResponse>;
  /** Fast autocomplete; should resolve in <150ms. */
  typeahead(request: TypeaheadRequest): Promise<TypeaheadResponse>;
}

// ── HTTP stub (uncomment + drop in the singleton when wiring) ────────
//
// Response contract notes for the backend team:
//   - Each SearchResult MAY carry `accentTagKind` (enum: 'lowest_price'
//     | 'bestseller'). When absent, the client falls
//     back to its mock hash-derivation. Once production reliably emits
//     it, the fallback in `variant.ts` can be removed.
//   - `badge` stays as a free-text editorial string ("Top" / "New" /
//     "Hot pick"). Localize server-side; the client renders verbatim.
//   - `isCheapest` is NOT a server concern — it's derived client-side
//     per visible page (it's a UI affordance, not a product attribute).
//
// See `text/07-search-row-signals-and-api.md` for the full design.

import { apiClient } from '@/services/api-client';

// The live backend already speaks the SearchResponse contract, but each
// result is minimal (`{id,title,price,category}`) and the required
// `description`/`priceLabel`/`score` fields (plus nullable envelope fields)
// need defaults so the search row never reads `undefined`. Typeahead uses
// `type` where the app expects `kind`. We normalize both here.

/** A live `/v1/search` result — everything past id/title is optional. */
type RawSearchResult = Partial<SearchResult> & {
  id: string;
  title: string;
  /**
   * Live backend rating fields (snake_case). `rating_avg` is `null` when
   * the product has no reviews yet — the row is hidden in that case.
   * `review_count` is shown verbatim.
   */
  rating_avg?: number | null;
  review_count?: number | null;
  /** Live backend key for the stable category id; app uses `categoryId`. */
  category_id?: string | null;
  /** Singular photo keys some endpoints emit instead of the `images` array. */
  image_url?: string | null;
  imageUrl?: string | null;
};

/**
 * Keep only well-formed category facets. This array is the one place the
 * search response carries an *identifier* the client will send back in
 * `filters.categories`, so a malformed entry is worse than a missing one: it
 * would render a chip that silently filters to nothing. Entries without a
 * usable id or name are dropped rather than trusted.
 */
function normalizeCategoryFacets(
  raw: SearchResponse['categories'],
): SearchCategoryFacet[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter(
      (c): c is SearchCategoryFacet =>
        !!c && typeof c.id === 'string' && c.id.length > 0 && typeof c.name === 'string',
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: typeof c.count === 'number' ? c.count : undefined,
    }));
}

/** The live `/v1/search` envelope — fields may be null / absent. */
type RawSearchResponse = Partial<Omit<SearchResponse, 'results'>> & {
  results?: RawSearchResult[] | null;
};

/** Collapse the backend's three photo spellings into one clean array. */
function normalizeImages(r: RawSearchResult): string[] | undefined {
  const raw = Array.isArray(r.images) ? r.images : [r.image_url ?? r.imageUrl];
  const clean = raw.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  return clean.length > 0 ? clean : undefined;
}

function normalizeSearchResult(r: RawSearchResult): SearchResult {
  const price = r.price ?? '';
  // Same title hygiene the catalog mapper applies, so a part reads identically
  // whether it was reached through search or through the catalog.
  return {
    id: r.id,
    title: normalizePartTitle(r.title).title || r.title,
    description: r.description ?? '',
    price,
    priceLabel: r.priceLabel ?? price,
    priceCents: r.priceCents,
    // Photos: the array when the backend sends one, else the singular key.
    // Empty/blank entries are dropped so the row shows the honest "no photo"
    // placeholder instead of an <Image> that resolves to nothing.
    images: normalizeImages(r),
    // Localized display string from the server — rendered, never keyed on.
    category: r.category ?? '',
    // Stable id (snake_case on the wire); the camelCase fallback covers a
    // pre-normalized transport.
    categoryId: r.category_id ?? r.categoryId ?? undefined,
    badge: r.badge,
    accentTagKind: r.accentTagKind,
    status: r.status,
    // Live backend emits snake_case `rating_avg`/`review_count`. When
    // `rating_avg` is null (no reviews yet) leave `rating` undefined so the
    // row hides it. camelCase fallbacks cover any pre-normalized transport.
    rating: r.rating_avg ?? r.rating,
    reviewCount: r.review_count ?? r.reviewCount,
    score: r.score ?? 0,
    explanation: r.explanation,
  };
}

type RawTypeaheadSuggestion = {
  text: string;
  /** Live backend key; app uses `kind`. */
  type?: string;
  kind?: string;
  productId?: string;
};

/** Catalog rows carry photos, part numbers and the exact amount; the search envelope does not (yet). */
type RawCatalogRow = Parameters<typeof resolvePartNumber>[0] & {
  id: string;
  images?: string[] | null;
  price_uzs?: number | null;
};

/** How many catalog rows to pull when hydrating results. 100 is the backend's
 *  cap, and comfortably covers the pages a shopper scrolls through. */
const CATALOG_HYDRATION_PAGE_SIZE = 100;

/** Results wait for this call, so it gets one short attempt rather than the
 *  client's default retries, which could hold them back for over 45 seconds. */
const CATALOG_HYDRATION_TIMEOUT_MS = 4_000;

/**
 * Fill in the photos and exact amounts `/v1/search` doesn't return.
 *
 * The search envelope ships id/title/price/category and nothing else, so every
 * result row drew the "no photo" placeholder even though the part HAS photos —
 * `/v1/catalog/parts` returns them for the very same ids. Its `price` is also
 * rounded to whole som (65730.24 arrives as "UZS 65 730"), and only the catalog
 * row holds the amount an order charges. One extra call on the same query closes
 * both gaps until search carries them itself.
 *
 * Best-effort by design: a failure here, or a part outside the catalog page,
 * leaves the placeholder and the API's own rounded label rather than failing the
 * search. See "Fractional prices" in docs/first-release-checklist.md.
 */
async function hydrateFromCatalog(
  results: SearchResult[],
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  if (results.length === 0) return results;
  const trimmed = query.trim();
  if (!trimmed) return results;

  try {
    const path =
      `/v1/catalog/parts?q=${encodeURIComponent(trimmed)}` +
      `&page=1&page_size=${CATALOG_HYDRATION_PAGE_SIZE}`;
    const raw = await apiClient.get<{ items?: RawCatalogRow[] }>(path, {
      signal,
      timeoutMs: CATALOG_HYDRATION_TIMEOUT_MS,
      maxRetries: 0,
    });
    const rows = new Map((raw.items ?? []).map((row) => [row.id, row]));
    // A part the catalog page didn't cover keeps its honest placeholder.
    return results.map((r) => {
      const row = rows.get(r.id);
      if (!row) return r;
      const images = (row.images ?? []).filter(
        (u): u is string => typeof u === 'string' && u.trim().length > 0,
      );
      // Same rule as the catalog mapper: a whole amount keeps the API's label.
      const exactPrice =
        typeof row.price_uzs === 'number' && !Number.isInteger(row.price_uzs)
          ? `UZS ${formatSomAmount(row.price_uzs)}`
          : r.price;
      return {
        ...r,
        price: exactPrice,
        // A label defaulted from the price follows it; a real lead-in stays.
        priceLabel: r.priceLabel === r.price ? exactPrice : r.priceLabel,
        images: images.length > 0 ? images : r.images,
        ...resolvePartNumber(row),
      };
    });
  } catch {
    return results;
  }
}

export class HttpSearchTransport implements SearchTransport {
  async search(req: SearchRequest): Promise<SearchResponse> {
    const { signal, requestId, ...body } = req;
    const raw = await apiClient.post<RawSearchResponse>('/v1/search', body, {
      signal,
      headers: requestId ? { 'X-Request-Id': requestId } : undefined,
    });
    const results = await hydrateFromCatalog(
      (raw.results ?? []).map(normalizeSearchResult),
      raw.query ?? req.query,
      signal,
    );
    return {
      query: raw.query ?? req.query.trim(),
      requestId: raw.requestId ?? requestId ?? '',
      results,
      total: raw.total ?? 0,
      // Backend returns `null` for "no next page"; the UI expects undefined.
      nextPageToken: raw.nextPageToken ?? undefined,
      didYouMean: raw.didYouMean ?? undefined,
      suggestedRefinements: raw.suggestedRefinements,
      // The preferred category contract: {id, name, count}. `id` is what
      // filters send, `name` is what the chip renders.
      categories: normalizeCategoryFacets(raw.categories),
      // Legacy facet map: keys are localized display strings, kept only so
      // chips can still look up a count.
      facetCounts: raw.facetCounts,
      appliedFilters: raw.appliedFilters,
      suggestedCategories: raw.suggestedCategories,
      durationMs: raw.durationMs ?? 0,
    };
  }

  async typeahead(req: TypeaheadRequest): Promise<TypeaheadResponse> {
    const path = `/v1/typeahead?q=${encodeURIComponent(req.prefix)}&limit=${req.limit ?? 6}`;
    const raw = await apiClient.get<{ prefix?: string; suggestions?: RawTypeaheadSuggestion[] }>(
      path,
      { signal: req.signal },
    );
    const suggestions = (raw.suggestions ?? []).map((s) => ({
      text: s.text,
      // Map the live `type` onto the app's `kind`; default to a query chip.
      kind: (s.kind ?? s.type) === 'product' ? 'product' : 'query',
      productId: s.productId,
    })) as TypeaheadResponse['suggestions'];
    return { prefix: raw.prefix ?? req.prefix, suggestions };
  }
}

export const searchTransport: SearchTransport = new HttpSearchTransport();
