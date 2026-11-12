// Test-only implementations. Never imported by application code.
import {
  brandRegion,
  isGmBrand,
  normalizeRegion,
  type CatalogRegion,
} from '@/constants/catalog-regions';
import { cleanCategoryName } from '@/utils/category-label';
import { normalizePartTitle } from '@/utils/part-title';
import { shouldUseHttpTransport } from '@/config/api';
import { apiClient, ApiError } from '@/services/api-client';

import type { CatalogItem, CatalogItemSpec, CatalogListRequest, CatalogBrandFacet, CatalogListResponse, CatalogDetailRequest, CatalogDetailResponse, CatalogSocketEvent } from "@/services/catalog-service";
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
    price: "UZS' 11,008,400",
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
    price: "UZS' 29,900",
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
    price: "UZS' 34,200",
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
    price: "UZS' 850,750",
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
    price: "UZS' 24,500",
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
    price: "UZS' 16,900",
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
        item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
    );
  }

  // Vehicle-fit + region filters (mirror the HTTP query).
  for (const term of [request.make, request.model]) {
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
  if (request.oemOnly) {
    items = items.filter((item) => Boolean(item.oem));
  }

  // Brands are counted before the brand filter, as the backend counts them. A
  // mock item's brand has no id of its own, so its name stands in for one.
  const brandCounts = new Map<string, number>();
  for (const item of items) {
    if (item.brand) brandCounts.set(item.brand, (brandCounts.get(item.brand) ?? 0) + 1);
  }
  const brandFacets = [...brandCounts].map(([name, count]) => ({ id: name, name, count }));
  if (request.brands?.length) {
    const want = new Set(request.brands);
    items = items.filter((item) => item.brand != null && want.has(item.brand));
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
    nextPage: nextPageOf(request.page, request.pageSize, items.length),
    brandFacets,
  };
}

export function getCatalogMockDetail(id: string): CatalogDetailResponse | null {
  const item = MOCK_CATALOG_ITEMS.find((i) => i.id === id);
  if (!item) return null;
  return { item };
}


function parsePrice(price: string): number { return Number(price.replace(/[^0-9.]/g, "")) || 0; }
function nextPageOf(page: number, pageSize: number, total: number): number | null { return page * pageSize < total ? page + 1 : null; }
