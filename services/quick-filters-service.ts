// ── Types ────────────────────────────────────────────────────────────

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';

/**
 * One quick-filter chip. Keep this lean — the row is dense and the
 * backend's job is to return the right list in the right order
 * (popularity / inventory count, etc.). Anything that doesn't render on
 * the chip itself belongs in a separate detail endpoint.
 */
export type QuickFilterItem = {
  /** Stable identifier — used as React key and as the value the
   *  backend echoes back when the chip is selected. */
  id: string;
  /** What renders on the chip. Backend-localized — frontend should NOT
   *  translate. */
  label: string;
  /** URL/route-safe slug (`cobalt`, `byd`, `lacetti`). The explore
   *  screen passes this when navigating to the View All page so the
   *  brand-locked context survives. */
  slug: string;
  /**
   * How the chip behaves when tapped. Today every item is a brand
   * filter — `kind` is here so the same row can later mix brands with
   * curated buckets ("New this week", "AI picks") without breaking the
   * existing UI contract.
   */
  kind: 'brand' | 'segment' | 'intent';
  /** Inventory count for the chip — backend's aggregated count, shown
   *  alongside the label when present. Optional so the row can render
   *  before the counter pipeline ships. */
  count?: number;
  /** Optional brand-logo / icon URL. Falls back to text-only chip when
   *  absent. */
  iconUrl?: string;
};

export type QuickFiltersListRequest = {
  /** Locale code (`en`, `ru`, `uz`). Backend may return labels and
   *  ordering tailored to the locale. */
  locale?: string;
  /** Maximum chips to return. The chip row is horizontally scrollable
   *  so this is a soft hint, not a hard cap. */
  limit?: number;
  /** Cancellation token — mock honors by aborting its delay; HTTP
   *  transport passes through to fetch(). */
  signal?: AbortSignal;
};

export type QuickFiltersListResponse = {
  items: QuickFilterItem[];
  /** Monotonically-increasing version string. Lets clients dedupe
   *  WebSocket refresh events against their current snapshot. */
  snapshotVersion: string;
};

// ── Seed fallback ────────────────────────────────────────────────────

/**
 * Hardcoded seed list — used as both the mock-transport response AND
 * the fallback the UI renders when the API returns 0 items / errors /
 * is still loading on first paint. The chip row never blanks out.
 *
 * Order matches the Uzbekistan market popularity ranking the product
 * team validated. Counts are illustrative; real counts come from the
 * backend's aggregation query (likely
 * `SELECT brand, COUNT(*) FROM parts GROUP BY brand ORDER BY count DESC`).
 *
 * Keep in sync with `mocks/search-page-backend-fields.txt`.
 */
export const QUICK_FILTERS_SEED: QuickFilterItem[] = [
  { id: 'qf-cobalt', label: 'Cobalt', slug: 'cobalt', kind: 'brand', count: 1240 },
  { id: 'qf-byd', label: 'BYD', slug: 'byd', kind: 'brand', count: 882 },
  { id: 'qf-lacetti', label: 'Lacetti', slug: 'lacetti', kind: 'brand', count: 614 },
  { id: 'qf-tracker', label: 'Tracker', slug: 'tracker', kind: 'brand', count: 503 },
  { id: 'qf-leapmotor', label: 'Leapmotor', slug: 'leapmotor', kind: 'brand', count: 297 },
];

// ── Mock service ─────────────────────────────────────────────────────

export function getQuickFiltersMockResponse(
  request: QuickFiltersListRequest = {},
): QuickFiltersListResponse {
  const limit = typeof request.limit === 'number' ? request.limit : QUICK_FILTERS_SEED.length;
  return {
    items: QUICK_FILTERS_SEED.slice(0, Math.max(0, limit)),
    snapshotVersion: 'mock-quick-filters-v1',
  };
}

// ── Transport ────────────────────────────────────────────────────────

const API_BASE = '/v1/search';
const MOCK_LATENCY_MS = 220;

export interface QuickFiltersTransport {
  list(request: QuickFiltersListRequest): Promise<QuickFiltersListResponse>;
}

class MockQuickFiltersTransport implements QuickFiltersTransport {
  async list(request: QuickFiltersListRequest): Promise<QuickFiltersListResponse> {
    await delay(MOCK_LATENCY_MS, request.signal);
    return getQuickFiltersMockResponse(request);
  }
}

class HttpQuickFiltersTransport implements QuickFiltersTransport {
  list(request: QuickFiltersListRequest): Promise<QuickFiltersListResponse> {
    const params = new URLSearchParams();
    if (request.locale) params.set('locale', request.locale);
    if (typeof request.limit === 'number') params.set('limit', String(request.limit));
    const qs = params.toString();
    return apiClient.get<QuickFiltersListResponse>(
      `${API_BASE}/quick-filters${qs ? `?${qs}` : ''}`,
      { signal: request.signal },
    );
  }
}

export const quickFiltersTransport: QuickFiltersTransport = shouldUseHttpTransport('search')
  ? new HttpQuickFiltersTransport()
  : new MockQuickFiltersTransport();

export function fetchQuickFilters(
  request: QuickFiltersListRequest = {},
): Promise<QuickFiltersListResponse> {
  return quickFiltersTransport.list(request);
}

// ── Helpers ──────────────────────────────────────────────────────────

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
