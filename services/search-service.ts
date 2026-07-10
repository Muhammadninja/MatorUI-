import { getCatalogMockItems, type CatalogItem } from '@/services/catalog-service';
import type {
  AccentTagKind,
  PriceBucket,
  RatingBucket,
  SearchFilters,
  SearchRequest,
  SearchResponse,
  SearchResult,
  TypeaheadRequest,
  TypeaheadResponse,
} from '@/types/search';

/**
 * Universal search across the marketplace.
 *
 * Tomorrow this hits `GET /v1/search?q=…&pageToken=…&filters=…`
 * (or whatever the backend defines). Today it runs in-process over the
 * catalog mock — but already supports the full smart-search surface:
 * filters server-side, facet counts, did-you-mean, pagination tokens,
 * request id echo. Components depend on the shapes in `types/search.ts`,
 * never on this module's concrete classes.
 *
 * Swap `searchTransport` to flip from mock to HTTP without touching any
 * caller.
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

// ── Mock transport ───────────────────────────────────────────────────

const MOCK_LATENCY_MS = 450;
const MOCK_TYPEAHEAD_LATENCY_MS = 80;
// Small page size in the mock — the catalog only has a handful of items,
// and we want pagination to trigger for any multi-match query so the
// UI's infinite-scroll path is exercised during dev. Real HTTP transport
// will receive a sensible default (e.g. 20) from the backend.
const DEFAULT_PAGE_SIZE = 2;

/** Slots for the mock accent-tag derivation. Mirrors the rotation that
 *  used to live in `variant.ts` so the mock transport "looks like" the
 *  future HTTP transport. Once the backend ships `accentTagKind`, this
 *  whole table goes away. */
const MOCK_ACCENT_KINDS: (AccentTagKind | null)[] = [
  'lowest_price',
  'bestseller',
  null,
  null,
];

function catalogToResult(item: CatalogItem, score: number): SearchResult {
  // Deterministic pseudo-rating + review count so the mock returns
  // consistent UI values without server data. Same formula as the
  // SearchResultRow uses, so client doesn't have to derive it.
  const h = hashCode(item.id);
  const rating = 3.8 + (h % 12) / 10;
  const reviewCount = 50 + (hashCode(item.id + ':r') % 5000);
  const accentTagKind =
    MOCK_ACCENT_KINDS[(h * 7) % MOCK_ACCENT_KINDS.length] ?? undefined;
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    price: item.price,
    priceLabel: item.priceLabel,
    priceCents: parsePriceToCents(item.price),
    category: item.category,
    badge: item.badge,
    accentTagKind,
    status: item.status,
    rating,
    reviewCount,
    score,
  };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Toy ranking — lowercase substring match on title (weight 1.0) and
 * description (weight 0.4). Real backend would use full-text search,
 * fuzzy matching, ML reranking, etc.
 */
function scoreItem(item: CatalogItem, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const title = item.title.toLowerCase();
  const description = item.description.toLowerCase();
  let score = 0;
  if (title.includes(q)) score += 1;
  if (title.startsWith(q)) score += 0.3;
  if (description.includes(q)) score += 0.4;
  if (item.category.toLowerCase().includes(q)) score += 0.2;
  return score;
}

function passesFilters(item: CatalogItem, filters?: SearchFilters): boolean {
  if (!filters) return true;
  if (filters.categories.length > 0 && !filters.categories.includes(item.category)) {
    return false;
  }
  if (filters.price !== 'any') {
    const cents = parsePriceToCents(item.price);
    if (filters.price === 'under_1k' && cents >= 100_000) return false;
    if (filters.price === '1k_to_10k' && (cents < 100_000 || cents > 1_000_000)) return false;
    if (filters.price === 'over_10k' && cents <= 1_000_000) return false;
  }
  if (filters.minRating !== 'any') {
    const h = hashCode(item.id);
    const rating = 3.8 + (h % 12) / 10;
    if (filters.minRating === '3_plus' && rating < 3) return false;
    if (filters.minRating === '4_plus' && rating < 4) return false;
  }
  return true;
}

/** Build per-bucket counts for the UI's filter sheet. */
function computeFacets(items: CatalogItem[]) {
  const categories: Record<string, number> = {};
  const price: Partial<Record<PriceBucket, number>> = {};
  const minRating: Partial<Record<RatingBucket, number>> = {};

  for (const item of items) {
    categories[item.category] = (categories[item.category] ?? 0) + 1;

    const cents = parsePriceToCents(item.price);
    if (cents < 100_000) price.under_1k = (price.under_1k ?? 0) + 1;
    else if (cents <= 1_000_000) price['1k_to_10k'] = (price['1k_to_10k'] ?? 0) + 1;
    else price.over_10k = (price.over_10k ?? 0) + 1;

    const rating = 3.8 + (hashCode(item.id) % 12) / 10;
    if (rating >= 3) minRating['3_plus'] = (minRating['3_plus'] ?? 0) + 1;
    if (rating >= 4) minRating['4_plus'] = (minRating['4_plus'] ?? 0) + 1;
  }
  return { categories, price, minRating };
}

const DEMO_DID_YOU_MEAN: Record<string, string> = {
  urbon: 'urban',
  cooupe: 'coupe',
  sedaan: 'sedan',
  trial: 'trail',
};

export class MockSearchTransport implements SearchTransport {
  async search(request: SearchRequest): Promise<SearchResponse> {
    const started = Date.now();
    await delay(MOCK_LATENCY_MS, request.signal);

    const query = request.query.trim();
    const limit = request.limit ?? DEFAULT_PAGE_SIZE;
    const startIndex = parsePageToken(request.pageToken);
    const all = getCatalogMockItems();

    // Score → filter (server-side) → sort.
    const scored = all
      .map((item) => ({ item, score: scoreItem(item, query) }))
      .filter((entry) => entry.score > 0)
      .filter((entry) => passesFilters(entry.item, request.filters));

    sortResults(scored, request.sortBy ?? 'relevance');

    const page = scored.slice(startIndex, startIndex + limit);
    const nextPageToken =
      startIndex + limit < scored.length ? makePageToken(startIndex + limit) : undefined;

    const didYouMean = DEMO_DID_YOU_MEAN[query.toLowerCase()];

    return {
      query,
      requestId: request.requestId ?? makeRequestId(),
      results: page.map(({ item, score }) => catalogToResult(item, score)),
      total: scored.length,
      nextPageToken,
      didYouMean,
      facetCounts: computeFacets(scored.map((s) => s.item)),
      appliedFilters: request.filters,
      suggestedCategories: Array.from(new Set(scored.map((s) => s.item.category))).slice(0, 4),
      durationMs: Date.now() - started,
    };
  }

  async typeahead(request: TypeaheadRequest): Promise<TypeaheadResponse> {
    await delay(MOCK_TYPEAHEAD_LATENCY_MS, request.signal);
    const prefix = request.prefix.trim().toLowerCase();
    if (prefix.length === 0) {
      return { prefix, suggestions: [] };
    }
    const all = getCatalogMockItems();
    const seen = new Set<string>();
    const suggestions: TypeaheadResponse['suggestions'] = [];
    for (const item of all) {
      const t = item.title.toLowerCase();
      // Suggest the full title when its prefix matches.
      if (t.startsWith(prefix) && !seen.has(item.title)) {
        suggestions.push({ text: item.title, kind: 'product', productId: item.id });
        seen.add(item.title);
        if (suggestions.length >= (request.limit ?? 6)) break;
      }
    }
    // Fall back to query-style suggestions (categories) when nothing matched.
    if (suggestions.length === 0) {
      const categories = Array.from(new Set(all.map((i) => i.category))).filter((c) =>
        c.toLowerCase().includes(prefix),
      );
      for (const c of categories.slice(0, request.limit ?? 6)) {
        suggestions.push({ text: c, kind: 'query' });
      }
    }
    return { prefix, suggestions };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function sortResults(
  entries: { item: CatalogItem; score: number }[],
  sortBy: NonNullable<SearchRequest['sortBy']>,
): void {
  switch (sortBy) {
    case 'price_asc':
      entries.sort((a, b) => parsePriceToCents(a.item.price) - parsePriceToCents(b.item.price));
      return;
    case 'price_desc':
      entries.sort((a, b) => parsePriceToCents(b.item.price) - parsePriceToCents(a.item.price));
      return;
    case 'rating':
      entries.sort((a, b) => {
        const ra = 3.8 + (hashCode(a.item.id) % 12) / 10;
        const rb = 3.8 + (hashCode(b.item.id) % 12) / 10;
        return rb - ra;
      });
      return;
    case 'newest':
      // No timestamp on catalog mocks; preserve relevance order.
      return;
    case 'relevance':
    default:
      entries.sort((a, b) => b.score - a.score);
  }
}

function parsePriceToCents(price: string): number {
  const numeric = Number(price.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function parsePageToken(token?: string): number {
  if (!token) return 0;
  const n = parseInt(token, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function makePageToken(offset: number): string {
  return String(offset);
}

function makeRequestId(): string {
  // Cheap unique-enough id — real impl should use a UUID lib.
  const r = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `req_${t}_${r}`;
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

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';

export class HttpSearchTransport implements SearchTransport {
  search(req: SearchRequest): Promise<SearchResponse> {
    const { signal, requestId, ...body } = req;
    return apiClient.post<SearchResponse>('/v1/search', body, {
      signal,
      headers: requestId ? { 'X-Request-Id': requestId } : undefined,
    });
  }

  typeahead(req: TypeaheadRequest): Promise<TypeaheadResponse> {
    const path = `/v1/typeahead?q=${encodeURIComponent(req.prefix)}&limit=${req.limit ?? 6}`;
    return apiClient.get<TypeaheadResponse>(path, { signal: req.signal });
  }
}

export const searchTransport: SearchTransport = shouldUseHttpTransport('search')
  ? new HttpSearchTransport()
  : new MockSearchTransport();
