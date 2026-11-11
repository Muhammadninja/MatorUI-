// ── Types ────────────────────────────────────────────────────────────

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

const API_BASE = '/v1/search';

export interface QuickFiltersTransport {
  list(request: QuickFiltersListRequest): Promise<QuickFiltersListResponse>;
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

export const quickFiltersTransport: QuickFiltersTransport = new HttpQuickFiltersTransport();

export function fetchQuickFilters(
  request: QuickFiltersListRequest = {},
): Promise<QuickFiltersListResponse> {
  return quickFiltersTransport.list(request);
}
