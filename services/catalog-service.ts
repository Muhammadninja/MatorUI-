// ── Types ────────────────────────────────────────────────────────────

export type CatalogItem = {
  id: string;
  badge: string;
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
    badge: 'Featured',
    status: 'Ready to ship',
    title: 'Urban Glide X',
    description: 'Compact EV for city runs with fast charge support.',
    price: '$18,400',
    priceLabel: 'Starting at',
    images: [],
    specs: MOCK_SPECS,
    features: MOCK_FEATURES,
    category: 'sedan',
  },
  {
    id: 'northline-suv',
    badge: 'Hot pick',
    status: 'Low stock',
    title: 'Northline SUV',
    description: 'Family-ready drive with smart safety assist and roomy cabin.',
    price: '$29,900',
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
    badge: 'Premium',
    status: 'Pre-order',
    title: 'Aero Coupe S',
    description: 'Sport coupe tuned for range, speed, and sleek daily comfort.',
    price: '$34,200',
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
    badge: 'New',
    status: 'Ready to ship',
    title: 'Trail Pro EV',
    description: 'Adventure-focused build with rugged stance and long battery life.',
    price: '$26,750',
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

// ── API Functions (replace mock calls when backend is ready) ─────────

const API_BASE = '/api/v1/catalog';

export async function fetchCatalogList(request: CatalogListRequest): Promise<CatalogListResponse> {
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE}/items?page=${request.page}&pageSize=${request.pageSize}`);
  // return response.json();
  return getCatalogMockList(request);
}

export async function fetchCatalogDetail(id: string): Promise<CatalogDetailResponse | null> {
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE}/items/${id}`);
  // return response.json();
  return getCatalogMockDetail(id);
}

// ── Helpers ──────────────────────────────────────────────────────────

function parsePrice(price: string): number {
  return Number(price.replace(/[^0-9.]/g, '')) || 0;
}
