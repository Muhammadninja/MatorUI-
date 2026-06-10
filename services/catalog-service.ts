// ── Types ────────────────────────────────────────────────────────────

export type CatalogItem = {
  id: string;
  /** Optional corner-ribbon label ("Hot pick", "New"). Items without
   *  a badge render with no ribbon. "Featured" and "Premium" were
   *  retired — don't reintroduce them. */
  badge?: string;
  status: string;
  title: string;
  description: string;
  price: string;
  priceLabel: string;
  images: string[];
  specs: CatalogItemSpec[];
  features: string[];
  category: string;
};

export type CatalogItemSpec = {
  label: string;
  value: string;
};

export type CatalogListRequest = {
  page: number;
  pageSize: number;
  category?: string;
  search?: string | null;
  sortBy?: 'featured' | 'newest' | 'price_asc' | 'price_desc';
  /** Cancellation token. The HTTP transport must pass this to fetch.
   *  Mock transport honors it by aborting the simulated delay. */
  signal?: AbortSignal;
};

export type CatalogListResponse = {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CatalogDetailRequest = {
  id: string;
};

export type CatalogDetailResponse = {
  item: CatalogItem;
};

export type CatalogSocketEvent = {
  event:
    | 'catalog.snapshot'
    | 'catalog.item.created'
    | 'catalog.item.updated'
    | 'catalog.item.deleted';
  timestamp: string;
  item?: CatalogItem;
  itemId?: string;
};

export const CATALOG_SOCKET_CHANNEL = 'catalog:items';
export const CATALOG_SOCKET_EVENTS: CatalogSocketEvent['event'][] = [
  'catalog.snapshot',
  'catalog.item.created',
  'catalog.item.updated',
  'catalog.item.deleted',
];

// ── Mock Data ────────────────────────────────────────────────────────

const MOCK_SPECS: CatalogItemSpec[] = [
  { label: 'Range', value: '320 mi' },
  { label: '0–60 mph', value: '4.2s' },
  { label: 'Top Speed', value: '155 mph' },
  { label: 'Drivetrain', value: 'AWD' },
];

const MOCK_FEATURES = [
  'Smart safety assist with collision avoidance',
  'Adaptive cruise control with lane centering',
  'Panoramic glass roof with UV protection',
  'Premium sound system with 12 speakers',
  'Over-the-air software updates',
];

const MOCK_CATALOG_ITEMS: CatalogItem[] = [
  {
    id: 'urban-glide-x',
    status: 'Ready to ship',
    title: 'Chevrolet Cobalt EV Urban Glide X',
    description: 'Compact EV for city runs with fast charge support.',
    price: 'UZS 11,008,400',
    priceLabel: 'Starting at',
    images: [],
    specs: MOCK_SPECS,
    features: MOCK_FEATURES,
    category: 'sedan',
  },
  {
    id: 'northline-suv',
    status: 'Low stock',
    title: 'Northline SUV Family Edition',
    description: 'Family-ready drive with smart safety assist and roomy cabin.',
    price: 'UZS29,900',
    priceLabel: 'Starting at',
    images: [],
    specs: [
      { label: 'Range', value: '280 mi' },
      { label: '0–60 mph', value: '5.1s' },
      { label: 'Top Speed', value: '140 mph' },
      { label: 'Drivetrain', value: 'AWD' },
    ],
    features: MOCK_FEATURES,
    category: 'suv',
  },
  {
    id: 'aero-coupe-s',
    status: 'Pre-order',
    title: 'Aero Coupe S',
    description: 'Sport coupe tuned for range, speed, and sleek daily comfort.',
    price: 'UZS 34,200',
    priceLabel: 'Starting at',
    images: [],
    specs: [
      { label: 'Range', value: '350 mi' },
      { label: '0–60 mph', value: '3.5s' },
      { label: 'Top Speed', value: '175 mph' },
      { label: 'Drivetrain', value: 'RWD' },
    ],
    features: MOCK_FEATURES,
    category: 'coupe',
  },
  {
    id: 'trail-pro-ev',
    status: 'Ready to ship',
    title: 'Cobalt Remen Generator Xitoy Original',
    description: 'Adventure-focused build with rugged stance and long battery life.',
    price: 'UZS 850,750',
    priceLabel: 'Starting at',
    images: [],
    specs: [
      { label: 'Range', value: '300 mi' },
      { label: '0–60 mph', value: '4.8s' },
      { label: 'Top Speed', value: '130 mph' },
      { label: 'Drivetrain', value: '4WD' },
    ],
    features: MOCK_FEATURES,
    category: 'truck',
  },
  // Test fixture for the "Mator Verified" ribbon. The id is chosen so
  // that `(hashCode(id) * 7) % tagOptions.length === 2` in variant.ts,
  // which deterministically maps to the Mator Verified slot. Mid-range
  // price so it won't be the cheapest in any result set (Cheapest would
  // otherwise override). Searchable by "elite", "mator", or "sedan".
  {
    id: 'mator-elite',
    status: 'Ready to ship',
    title: 'Mator Elite Sedan',
    description: 'Premium sedan with Mator Verified inspection and warranty.',
    price: 'UZS 24,500',
    priceLabel: 'Starting at',
    images: [],
    specs: [
      { label: 'Range', value: '320 mi' },
      { label: '0–60 mph', value: '4.2s' },
      { label: 'Top Speed', value: '155 mph' },
      { label: 'Drivetrain', value: 'AWD' },
    ],
    features: MOCK_FEATURES,
    category: 'sedan',
  },
  // Test fixture for the COMPOSITE "Elite Pick" ribbon (Option A
  // escalation). This product qualifies for all three signal sources:
  //   - lowest price in the catalog ($16,900) → Cheapest
  //   - server badge "Bestseller"             → Bestseller
  //   - id 'mator-prime' hashes to slot 2     → Mator Verified
  // resolvePriceSignal collapses them into a single "ELITE PICK"
  // ribbon that carries all three icons. Searchable by "prime", "mator".
  {
    id: 'mator-prime',
    status: 'Ready to ship',
    title: 'Mator Prime',
    description: 'Flagship sedan — top-selling, lowest entry price, full Mator Verified inspection.',
    price: 'UZS 16,900',
    priceLabel: 'Starting at',
    badge: 'Bestseller',
    images: [],
    specs: [
      { label: 'Range', value: '340 mi' },
      { label: '0–60 mph', value: '3.9s' },
      { label: 'Top Speed', value: '160 mph' },
      { label: 'Drivetrain', value: 'AWD' },
    ],
    features: MOCK_FEATURES,
    category: 'sedan',
  },
];

// ── Mock Service Functions ───────────────────────────────────────────

export function getCatalogMockItems(): CatalogItem[] {
  return MOCK_CATALOG_ITEMS;
}

export function getCatalogMockList(request: CatalogListRequest): CatalogListResponse {
  let items = [...MOCK_CATALOG_ITEMS];

  if (request.category) {
    items = items.filter((item) => item.category === request.category);
  }

  if (request.search) {
    const query = request.search.toLowerCase();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query),
    );
  }

  if (request.sortBy === 'price_asc') {
    items.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
  } else if (request.sortBy === 'price_desc') {
    items.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
  }

  const start = (request.page - 1) * request.pageSize;
  const paged = items.slice(start, start + request.pageSize);

  return {
    items: paged,
    total: items.length,
    page: request.page,
    pageSize: request.pageSize,
  };
}

export function getCatalogMockDetail(id: string): CatalogDetailResponse | null {
  const item = MOCK_CATALOG_ITEMS.find((i) => i.id === id);
  if (!item) return null;
  return { item };
}

// ── Transport ────────────────────────────────────────────────────────

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient, ApiError } from '@/services/api-client';

const API_BASE = '/api/v1/catalog';
const MOCK_LATENCY_MS = 350;

export interface CatalogTransport {
  list(request: CatalogListRequest): Promise<CatalogListResponse>;
  detail(id: string, signal?: AbortSignal): Promise<CatalogDetailResponse | null>;
}

class MockCatalogTransport implements CatalogTransport {
  async list(request: CatalogListRequest): Promise<CatalogListResponse> {
    await delay(MOCK_LATENCY_MS, request.signal);
    return getCatalogMockList(request);
  }
  async detail(id: string, signal?: AbortSignal): Promise<CatalogDetailResponse | null> {
    await delay(MOCK_LATENCY_MS, signal);
    return getCatalogMockDetail(id);
  }
}

class HttpCatalogTransport implements CatalogTransport {
  list(request: CatalogListRequest): Promise<CatalogListResponse> {
    const params = new URLSearchParams({
      page: String(request.page),
      pageSize: String(request.pageSize),
    });
    if (request.category) params.set('category', request.category);
    if (request.search) params.set('search', request.search);
    if (request.sortBy) params.set('sortBy', request.sortBy);
    return apiClient.get<CatalogListResponse>(`${API_BASE}/items?${params.toString()}`, {
      signal: request.signal,
    });
  }
  async detail(id: string, signal?: AbortSignal): Promise<CatalogDetailResponse | null> {
    try {
      return await apiClient.get<CatalogDetailResponse>(`${API_BASE}/items/${id}`, { signal });
    } catch (err) {
      // 404 is a normal "not found" — surface as null instead of throwing.
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }
}

export const catalogTransport: CatalogTransport = shouldUseHttpTransport()
  ? new HttpCatalogTransport()
  : new MockCatalogTransport();

// Back-compat facades — existing callers (hooks/use-catalog-*) keep working.
export function fetchCatalogList(request: CatalogListRequest): Promise<CatalogListResponse> {
  return catalogTransport.list(request);
}
export function fetchCatalogDetail(
  id: string,
  signal?: AbortSignal,
): Promise<CatalogDetailResponse | null> {
  return catalogTransport.detail(id, signal);
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Simulated delay that respects an AbortSignal — used by the mock. */
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

function parsePrice(price: string): number {
  return Number(price.replace(/[^0-9.]/g, '')) || 0;
}
