// ── Types ────────────────────────────────────────────────────────────

import { brandRegion, isGmBrand, normalizeRegion, type CatalogRegion } from '@/constants/catalog-regions';

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
  /** Manufacturer / OEM part number ("GM 15823942", "BYD-1090012",
   *  etc.). Rendered as a small gray pill on the card and detail
   *  screen so shoppers can cross-reference against existing parts.
   *  Optional — items without a number simply omit the pill. */
  oem?: string;
  /** Market of origin (China / Europe / Russia / Korea / USA), used by the
   *  region filter. Backend-supplied when available, else inferred from the
   *  brand at map time. */
  region?: CatalogRegion;
};

export type CatalogItemSpec = {
  label: string;
  value: string;
};

export type CatalogListRequest = {
  page: number;
  pageSize: number;
  /** System / category key (from the catalog systems screen). */
  category?: string;
  search?: string | null;
  sortBy?: 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'relevance';
  /** Vehicle-fit context from the Make → Model flow. */
  make?: string;
  model?: string;
  /** Fine filters. */
  brand?: string;
  /** Market-of-origin regions (china/europe/russia/korea/usa); empty/undefined = all. */
  regions?: string[];
  /** Restrict to GM-family brands (Chevrolet / Ravon / Daewoo …). */
  gmOnly?: boolean;
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
  { label: '0-60 mph', value: '4.2s' },
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
    oem: 'GM 96289942',
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
      { label: '0-60 mph', value: '5.1s' },
      { label: 'Top Speed', value: '140 mph' },
      { label: 'Drivetrain', value: 'AWD' },
    ],
    features: MOCK_FEATURES,
    category: 'suv',
    oem: 'NL-SUV-8801',
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
      { label: '0-60 mph', value: '3.5s' },
      { label: 'Top Speed', value: '175 mph' },
      { label: 'Drivetrain', value: 'RWD' },
    ],
    features: MOCK_FEATURES,
    category: 'coupe',
    oem: 'AC-S-2204',
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
      { label: '0-60 mph', value: '4.8s' },
      { label: 'Top Speed', value: '130 mph' },
      { label: 'Drivetrain', value: '4WD' },
    ],
    features: MOCK_FEATURES,
    category: 'truck',
    oem: 'GM 13578901',
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
      { label: '0-60 mph', value: '4.2s' },
      { label: 'Top Speed', value: '155 mph' },
      { label: 'Drivetrain', value: 'AWD' },
    ],
    features: MOCK_FEATURES,
    category: 'sedan',
    oem: 'MTR-EL-001',
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
    description: 'Flagship sedan, top-selling, lowest entry price, full Mator Verified inspection.',
    price: 'UZS 16,900',
    priceLabel: 'Starting at',
    badge: 'Bestseller',
    images: [],
    specs: [
      { label: 'Range', value: '340 mi' },
      { label: '0-60 mph', value: '3.9s' },
      { label: 'Top Speed', value: '160 mph' },
      { label: 'Drivetrain', value: 'AWD' },
    ],
    features: MOCK_FEATURES,
    category: 'sedan',
    oem: 'MTR-PR-001',
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

  // Vehicle-fit + brand + region filters (mirror the HTTP query).
  for (const term of [request.make, request.model, request.brand]) {
    if (term) {
      const t = term.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(t) || item.description.toLowerCase().includes(t),
      );
    }
  }
  if (request.regions?.length) {
    const want = new Set(request.regions);
    items = items.filter((item) => {
      const region = item.region ?? brandRegion(item.title) ?? brandRegion(item.description);
      return region != null && want.has(region);
    });
  }
  if (request.gmOnly) {
    items = items.filter((item) => isGmBrand(item.title) || isGmBrand(item.description));
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

const API_BASE = '/v1/catalog';
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

// ── Live backend shape (GET /v1/catalog/parts) ───────────────────────
// The real catalog is a parts marketplace exposed at `/v1/catalog/parts`
// with snake_case params + a nested part shape. We map it onto the app's
// flat `CatalogItem`. NOTE: the backend strictly rejects unknown query
// params (it 400s on `pageSize`), so we send ONLY `page`/`page_size` for
// now; wire `search`/`category` once their accepted param names are known.
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
  specs?: { label: string; value: string }[];
  features?: string[];
  /** Market of origin, if the backend tags it (e.g. "china", "korea"). */
  region?: string;
};

type ApiCatalogPartsResponse = {
  items: ApiCatalogPart[];
  total: number;
  page: number;
  page_size: number;
  next_page: number | null;
};

function mapPartToCatalogItem(p: ApiCatalogPart): CatalogItem {
  return {
    id: p.id,
    status: p.in_stock === false ? 'Out of stock' : 'In stock',
    title: p.title,
    description: [p.brand?.name, p.category?.name].filter(Boolean).join(' · '),
    price:
      p.price_label ??
      (p.price_uzs != null ? `UZS ${p.price_uzs.toLocaleString('ru-RU')}` : ''),
    priceLabel: '',
    images: p.images ?? [],
    specs: p.specs ?? [],
    features: p.features ?? [],
    category: p.category?.name ?? '',
    oem: p.oem_numbers?.[0],
    // Prefer the backend's tagged region; fall back to brand inference.
    region: normalizeRegion(p.region) ?? brandRegion(p.brand?.name),
  };
}

// Query-param names for GET /v1/catalog/parts. The backend STRICTLY rejects
// unknown params (400 on `pageSize`), so these must match the backend's
// Swagger exactly. Names below are the assumed snake_case set derived from the
// endpoint's response facets (`brands`, `price_range_uzs`, `compatibility`).
// If a filter 400s, correct the value here — it's the single source of truth.
const PARTS_PARAM = {
  page: 'page',
  pageSize: 'page_size',
  search: 'q',
  category: 'category',
  make: 'make',
  model: 'model',
  brand: 'brand',
  region: 'region',
  gmOnly: 'gm_only',
  sort: 'sort',
} as const;

class HttpCatalogTransport implements CatalogTransport {
  async list(request: CatalogListRequest): Promise<CatalogListResponse> {
    const params = new URLSearchParams({
      [PARTS_PARAM.page]: String(request.page),
      [PARTS_PARAM.pageSize]: String(request.pageSize),
    });
    if (request.search) params.set(PARTS_PARAM.search, request.search);
    if (request.category) params.set(PARTS_PARAM.category, request.category);
    if (request.make) params.set(PARTS_PARAM.make, request.make);
    if (request.model) params.set(PARTS_PARAM.model, request.model);
    if (request.brand) params.set(PARTS_PARAM.brand, request.brand);
    // Region is multi-select → repeated `region=` params (e.g. region=china&region=korea).
    request.regions?.forEach((r) => params.append(PARTS_PARAM.region, r));
    if (request.gmOnly) params.set(PARTS_PARAM.gmOnly, 'true');
    if (request.sortBy) params.set(PARTS_PARAM.sort, request.sortBy);
    const res = await apiClient.get<ApiCatalogPartsResponse>(
      `${API_BASE}/parts?${params.toString()}`,
      { signal: request.signal },
    );
    return {
      items: res.items.map(mapPartToCatalogItem),
      total: res.total,
      page: res.page,
      pageSize: res.page_size,
    };
  }
  async detail(id: string, signal?: AbortSignal): Promise<CatalogDetailResponse | null> {
    try {
      const part = await apiClient.get<ApiCatalogPart>(`${API_BASE}/parts/${id}`, { signal });
      return part ? { item: mapPartToCatalogItem(part) } : null;
    } catch (err) {
      // 404 is a normal "not found" — surface as null instead of throwing.
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }
}

export const catalogTransport: CatalogTransport = shouldUseHttpTransport('catalog')
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
