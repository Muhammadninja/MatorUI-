import TOP_FEATURED_ITEMS from '@/components/screens-components/search/search-top-featured.data';

export const TOP_FEATURED_FILTER_GROUPS = [
  {
    key: 'model',
    title: 'Model',
    options: ['Sedan', 'SUV', 'Coupe', 'Truck'],
  },
  {
    key: 'brand',
    title: 'Brand',
    // Match the explore-screen quick-filter chips (UZ top brands) so the
    // filter sheet and the chip row stay coherent — opening Brand in
    // the sheet now shows the same five options the user already sees
    // on the chip row.
    options: ['Cobalt', 'BYD', 'Lacetti', 'Tracker', 'Leapmotor'],
  },
  {
    key: 'color',
    title: 'Color',
    options: ['Black', 'White', 'Silver', 'Red'],
  },
  {
    key: 'condition',
    title: 'Condition',
    // Must exactly mirror the `condition` values present in
    // MOCK_ITEM_ATTRIBUTES below — every chip must match ≥1 item and no
    // selectable/default value may be unselectable.
    options: ['New', 'OEM', 'Restored', 'Budget'],
  },
] as const;

export type TopFeaturedFilterGroup = (typeof TOP_FEATURED_FILTER_GROUPS)[number];
export type TopFeaturedFilterKey = TopFeaturedFilterGroup['key'];
export type TopFeaturedFilterTitle = TopFeaturedFilterGroup['title'];

export type TopFeaturedFilters = Record<TopFeaturedFilterTitle, string>;

export type TopFeaturedItem = {
  id: string;
  badge: string;
  status: string;
  title: string;
  description: string;
  price: string;
  model: string;
  brand: string;
  color: string;
  condition: string;
  /** Product image URLs. Optional so the contract is ready before the
   *  backend ships URLs; UI falls back to a placeholder when absent or
   *  empty. */
  images?: string[];
  /** Manufacturer / OEM part number (e.g. "GM 15823942",
   *  "BYD-1090012"). Rendered as a small gray pill on the card and
   *  detail screen — optional so items without a number simply omit
   *  the pill. */
  oem?: string;
};

export type TopFeaturedFilterOptionPayload = {
  value: string;
  label: string;
  count?: number;
};

export type TopFeaturedAvailableFilterPayload = {
  key: TopFeaturedFilterKey;
  title: TopFeaturedFilterTitle;
  options: TopFeaturedFilterOptionPayload[];
};

export type TopFeaturedListRequest = {
  page: number;
  pageSize: number;
  filters: Partial<Record<TopFeaturedFilterKey, string>>;
  search?: string | null;
  sortBy?: 'featured' | 'newest' | 'price_asc' | 'price_desc';
  /** Cancellation token. Mock transport honors it by aborting the
   *  simulated delay; HTTP transport must pass it to fetch(). */
  signal?: AbortSignal;
};

export type TopFeaturedListResponse = {
  items: TopFeaturedItem[];
  total: number;
  page: number;
  pageSize: number;
  availableFilters: TopFeaturedAvailableFilterPayload[];
  snapshotVersion: string;
  socketChannel: string;
};

export type TopFeaturedSocketEvent = {
  event:
    | 'top_featured.snapshot'
    | 'top_featured.item.created'
    | 'top_featured.item.updated'
    | 'top_featured.item.deleted'
    | 'top_featured.filters.updated';
  snapshotVersion: string;
  timestamp: string;
  item?: TopFeaturedItem;
  itemId?: string;
  availableFilters?: TopFeaturedAvailableFilterPayload[];
};

export const TOP_FEATURED_SOCKET_CHANNEL = 'top_featured:catalog';
export const TOP_FEATURED_SOCKET_EVENTS: TopFeaturedSocketEvent['event'][] = [
  'top_featured.snapshot',
  'top_featured.item.created',
  'top_featured.item.updated',
  'top_featured.item.deleted',
  'top_featured.filters.updated',
];

// The unfiltered default: no dimension is pre-selected, so the list
// shows every item. "Clear filters" resets to exactly this, producing a
// truly unfiltered list rather than re-applying a hidden filter set.
export const DEFAULT_TOP_FEATURED_FILTERS: TopFeaturedFilters = {
  Model: '',
  Brand: '',
  Color: '',
  Condition: '',
};

const MOCK_ITEM_ATTRIBUTES: Record<
  string,
  Omit<TopFeaturedItem, 'badge' | 'status' | 'title' | 'description' | 'price'>
> = {
  // Brands match the explore-screen quick-filter chips (UZ top brands).
  // Cobalt gets two items so the most-popular chip surfaces a slightly
  // busier grid than the others when filtered. See
  // components/screens-components/search/search-quick-filters.tsx for
  // the canonical chip list.
  f1: { id: 'f1', model: 'SUV', brand: 'Cobalt', color: 'Black', condition: 'New', oem: 'GM 15823942' },
  f2: { id: 'f2', model: 'Coupe', brand: 'BYD', color: 'White', condition: 'OEM', oem: 'BYD-1090012' },
  f3: { id: 'f3', model: 'Sedan', brand: 'Lacetti', color: 'Silver', condition: 'Restored', oem: 'OEM 96405028' },
  f4: { id: 'f4', model: 'Truck', brand: 'Tracker', color: 'Red', condition: 'Budget', oem: 'GM 13578934' },
  f5: { id: 'f5', model: 'SUV', brand: 'Leapmotor', color: 'Black', condition: 'New', oem: 'LM-T03-1009' },
  f6: { id: 'f6', model: 'Coupe', brand: 'Cobalt', color: 'Silver', condition: 'OEM', oem: 'GM 96289942' },
};

const FILTER_TITLE_TO_KEY: Record<TopFeaturedFilterTitle, TopFeaturedFilterKey> = {
  Model: 'model',
  Brand: 'brand',
  Color: 'color',
  Condition: 'condition',
};

export function getSelectedTopFeaturedFilterEntries(filters: TopFeaturedFilters) {
  return Object.entries(filters).filter(([, value]) => Boolean(value)) as Array<
    [TopFeaturedFilterTitle, string]
  >;
}

export function buildTopFeaturedListRequest(filters: TopFeaturedFilters): TopFeaturedListRequest {
  const selectedEntries = getSelectedTopFeaturedFilterEntries(filters);

  return {
    page: 1,
    pageSize: 24,
    sortBy: 'featured',
    search: null,
    filters: selectedEntries.reduce<Partial<Record<TopFeaturedFilterKey, string>>>(
      (accumulator, [title, value]) => {
        accumulator[FILTER_TITLE_TO_KEY[title]] = value;
        return accumulator;
      },
      {},
    ),
  };
}

export function getTopFeaturedMockItems(): TopFeaturedItem[] {
  return TOP_FEATURED_ITEMS.map((item) => ({
    ...item,
    ...MOCK_ITEM_ATTRIBUTES[item.id],
  }));
}

export function getTopFeaturedMockDetail(id: string): TopFeaturedItem | null {
  return getTopFeaturedMockItems().find((item) => item.id === id) ?? null;
}

export function getTopFeaturedMockResponse(filters: TopFeaturedFilters): TopFeaturedListResponse {
  const request = buildTopFeaturedListRequest(filters);
  const items = getTopFeaturedMockItems().filter((item) => {
    return Object.entries(request.filters).every(([key, value]) => {
      if (!value) return true;
      return item[key as TopFeaturedFilterKey] === value;
    });
  });

  return {
    items,
    total: items.length,
    page: request.page,
    pageSize: request.pageSize,
    snapshotVersion: 'mock-snapshot-v1',
    socketChannel: TOP_FEATURED_SOCKET_CHANNEL,
    availableFilters: TOP_FEATURED_FILTER_GROUPS.map((group) => ({
      key: group.key,
      title: group.title,
      options: group.options.map((option) => ({
        value: option,
        label: option,
      })),
    })),
  };
}

// ── API Functions (replace mock calls when backend is ready) ─────────

const API_BASE = '/v1/top-featured';
const MOCK_LATENCY_MS = 320;

/** Same delay helper pattern as the catalog service — promise that
 *  resolves after `ms` ms but rejects with AbortError if `signal` aborts
 *  in the interim. Mirrors what real fetch() does so loading + abort
 *  paths are testable against the mock. */
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

// ── Transport ────────────────────────────────────────────────────────

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';

export interface TopFeaturedTransport {
  list(request: TopFeaturedListRequest): Promise<TopFeaturedListResponse>;
}

class MockTopFeaturedTransport implements TopFeaturedTransport {
  async list(request: TopFeaturedListRequest): Promise<TopFeaturedListResponse> {
    await delay(MOCK_LATENCY_MS, request.signal);
    // Reuse the filter math from getTopFeaturedMockResponse, but build
    // it from the request directly (not from a TopFeaturedFilters map)
    // so the contract aligns with how HTTP will hand us the request.
    const items = getTopFeaturedMockItems().filter((item) => {
      return Object.entries(request.filters).every(([key, value]) => {
        if (!value) return true;
        return item[key as TopFeaturedFilterKey] === value;
      });
    });
    return {
      items,
      total: items.length,
      page: request.page,
      pageSize: request.pageSize,
      snapshotVersion: 'mock-snapshot-v1',
      socketChannel: TOP_FEATURED_SOCKET_CHANNEL,
      availableFilters: TOP_FEATURED_FILTER_GROUPS.map((group) => ({
        key: group.key,
        title: group.title,
        options: group.options.map((option) => ({
          value: option,
          label: option,
        })),
      })),
    };
  }
}

// ── Live "all parts" catalog shape (GET /v1/catalog/parts) ────────────
// The backend's real /v1/top-featured/list snapshot is empty (no parts
// flagged featured yet), so — TEMPORARILY — we source the Top Featured
// grid from the populated "all parts" catalog endpoint and map each part
// onto the TopFeaturedItem the cards render. Revert `HttpTopFeaturedTransport`
// to the `POST ${API_BASE}/list` one-liner once the featured snapshot is built.

type ApiCatalogPart = {
  id: string;
  title: string;
  brand?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  oem_numbers?: string[];
  price_uzs?: number;
  price_label?: string;
  in_stock?: boolean;
  stock_qty?: number;
  images?: string[];
};

type ApiCatalogPartsResponse = {
  items: ApiCatalogPart[];
  total: number;
  page: number;
  page_size: number;
  next_page: number | null;
};

function mapPartToTopFeaturedItem(p: ApiCatalogPart): TopFeaturedItem {
  return {
    id: p.id,
    badge: '',
    status: p.in_stock ? 'In stock' : 'Out of stock',
    title: p.title,
    description: [p.brand?.name, p.category?.name].filter(Boolean).join(' · '),
    price: p.price_label ?? (p.price_uzs != null ? `UZS ${p.price_uzs.toLocaleString('ru-RU')}` : ''),
    model: '',
    brand: p.brand?.name ?? '',
    color: '',
    condition: '',
    images: p.images ?? [],
    oem: p.oem_numbers?.[0],
  };
}

class HttpTopFeaturedTransport implements TopFeaturedTransport {
  async list(request: TopFeaturedListRequest): Promise<TopFeaturedListResponse> {
    const params = new URLSearchParams({
      page: String(request.page),
      page_size: String(request.pageSize),
    });
    if (request.search) params.set('search', request.search);
    const res = await apiClient.get<ApiCatalogPartsResponse>(
      `/v1/catalog/parts?${params.toString()}`,
      { signal: request.signal },
    );

    let items = res.items.map(mapPartToTopFeaturedItem);
    // The catalog endpoint filters brand by id, not name; the UI passes a
    // brand *name* — so honor a brand chip client-side over the page.
    const brand = request.filters?.brand;
    if (brand) {
      items = items.filter((i) => i.brand.toLowerCase() === brand.toLowerCase());
    }

    // Derive the brand filter options from whatever brands are on the page.
    const brandOptions = Array.from(new Set(items.map((i) => i.brand).filter(Boolean))).map(
      (b) => ({ value: b, label: b }),
    );

    return {
      items,
      total: brand ? items.length : res.total,
      page: res.page,
      pageSize: res.page_size,
      snapshotVersion: 'catalog-parts-fallback',
      socketChannel: TOP_FEATURED_SOCKET_CHANNEL,
      availableFilters: [{ key: 'brand', title: 'Brand', options: brandOptions }],
    };
  }
}

export const topFeaturedTransport: TopFeaturedTransport = shouldUseHttpTransport('top-featured')
  ? new HttpTopFeaturedTransport()
  : new MockTopFeaturedTransport();

// Back-compat facade — existing callers keep working.
export function fetchTopFeaturedList(
  request: TopFeaturedListRequest,
): Promise<TopFeaturedListResponse> {
  return topFeaturedTransport.list(request);
}
