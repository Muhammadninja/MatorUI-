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
    options: ['Toyota', 'BMW', 'Tesla', 'Audi'],
  },
  {
    key: 'color',
    title: 'Color',
    options: ['Black', 'White', 'Silver', 'Red'],
  },
  {
    key: 'condition',
    title: 'Condition',
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

export const DEFAULT_TOP_FEATURED_FILTERS: TopFeaturedFilters = {
  Model: 'SUV',
  Brand: 'Tesla',
  Color: 'Black',
  Condition: 'New',
};

const MOCK_ITEM_ATTRIBUTES: Record<
  string,
  Omit<TopFeaturedItem, 'badge' | 'status' | 'title' | 'description' | 'price'>
> = {
  f1: { id: 'f1', model: 'SUV', brand: 'Tesla', color: 'Black', condition: 'New' },
  f2: { id: 'f2', model: 'Coupe', brand: 'BMW', color: 'White', condition: 'OEM' },
  f3: { id: 'f3', model: 'Sedan', brand: 'Toyota', color: 'Silver', condition: 'Restored' },
  f4: { id: 'f4', model: 'Truck', brand: 'Audi', color: 'Red', condition: 'Budget' },
  f5: { id: 'f5', model: 'SUV', brand: 'Tesla', color: 'Black', condition: 'New' },
  f6: { id: 'f6', model: 'Coupe', brand: 'BMW', color: 'Silver', condition: 'OEM' },
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

const API_BASE = '/api/v1/top-featured';
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

class HttpTopFeaturedTransport implements TopFeaturedTransport {
  list(request: TopFeaturedListRequest): Promise<TopFeaturedListResponse> {
    const { signal, ...body } = request;
    return apiClient.post<TopFeaturedListResponse>(`${API_BASE}/list`, body, { signal });
  }
}

export const topFeaturedTransport: TopFeaturedTransport = shouldUseHttpTransport()
  ? new HttpTopFeaturedTransport()
  : new MockTopFeaturedTransport();

// Back-compat facade — existing callers keep working.
export function fetchTopFeaturedList(
  request: TopFeaturedListRequest,
): Promise<TopFeaturedListResponse> {
  return topFeaturedTransport.list(request);
}
