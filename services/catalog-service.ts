// ── Types ────────────────────────────────────────────────────────────

import { brandRegion, CATALOG_REGIONS, isGmBrand, normalizeRegion, type CatalogRegion } from '@/constants/catalog-regions';
import { cleanCategoryName } from '@/utils/category-label';

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
  /** Numeric list price in UZS (the same value `price` is formatted from), kept
   *  raw so callers can do math on it — the sale matcher reconstructs the
   *  pre-discount "was" price, the cart reads it, etc. Absent when the backend
   *  omits a numeric price. */
  priceUzs?: number;
  priceLabel: string;
  images: string[];
  specs: CatalogItemSpec[];
  features: string[];
  category: string;
  /** Part manufacturer brand (e.g. "Gates", "Dayco"), from the backend `brand`
   *  entity — NOT the car make (the vehicle lives in `title` + the make/model
   *  query filters + per-row compatibility). Shown as the card subtitle (via
   *  `description`) and drives the client-side Brand filter. */
  brand?: string;
  /** Manufacturer / OEM part number ("GM 15823942", "BYD-1090012",
   *  etc.). Rendered as a small gray pill on the card and detail
   *  screen so shoppers can cross-reference against existing parts.
   *  Optional — items without a number simply omit the pill. */
  oem?: string;
  /** GM (General Motors) cross-reference number, when the part carries
   *  one. Shown alongside the OEM number on the product row. */
  gm?: string;
  /** Estimated delivery window in days, when the backend provides it. */
  deliveryEtaMinDays?: number;
  deliveryEtaMaxDays?: number;
  /** Market of origin (China / Europe / Russia / Korea / USA), used by the
   *  region filter. Backend-supplied when available, else inferred from the
   *  brand at map time. */
  region?: CatalogRegion;
  /** MATOR Certified seller — mirrors the customer-facing `seller.certified`
   *  flag the operator panel toggles (admin `POST /v1/admin/dealers/:id/certify`).
   *  Drives the "MATOR Certified" trust badge. Absent until the backend exposes
   *  it on the catalog part's seller — see `docs/mator-certified-contract.md`. */
  certified?: boolean;
  /** Lowest-price guarantee badge, when the seller carries one. */
  lowestPrice?: boolean;
  /** Seller storefront name, when the catalog part carries one. */
  sellerName?: string;
  /** Category id (e.g. "oil-and-fluids"), kept alongside the display `category`
   *  name so a CATEGORIES-scoped sale can be matched to this item. */
  categoryId?: string;
  /** Seller storefront id, so a DEALERS-scoped sale can be matched. */
  sellerId?: string;
  /** Backend-resolved active sale — the authoritative source for the discount
   *  badge. When set, `priceUzs`/`price` are ALREADY the sale price and
   *  `originalPriceUzs` is the pre-discount price. Present only once the backend
   *  applies sales (mator.uz catalog pricing); the client `/v1/sales` matcher is
   *  the fallback. */
  salePercent?: number;
  originalPriceUzs?: number;
  /** Product kind. "MOTOR_OIL" listings render an oil card (oil attributes, no
   *  OEM/GM row); "SPARE_PART" is the default. Absent → treat as a spare part. */
  kind?: 'SPARE_PART' | 'MOTOR_OIL';
  /** Motor-oil attributes — present only for `kind === "MOTOR_OIL"`. Prefer the
   *  pre-localized `*Label` fields for display. */
  motorOil?: {
    viscosity?: string;
    /** Raw enum. */
    oilType?: 'SYNTHETIC' | 'SEMI_SYNTHETIC' | 'MINERAL';
    /** Pre-localized (e.g. "Синтетическое"). */
    oilTypeLabel?: string;
    volumeMl?: number;
    /** Pre-localized (e.g. "4 л"). */
    volumeLabel?: string;
  } | null;
  /** True for universal listings (oils under "Другое"). Universal parts render
   *  "Подходит для всех" and NEVER a compatibility badge — `fits` is empty and
   *  the backend deliberately returns a null compatibility. The single source of
   *  truth for universal vs vehicle-specific; never infer from the category name. */
  isUniversal?: boolean;
  /** Vehicle fitments backing the compatibility chips. Empty for universal parts. */
  fits?: {
    makeSlug?: string;
    makeName?: string;
    modelSlug?: string;
    modelName?: string;
  }[];
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
  sortBy?: 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'relevance' | 'bestseller';
  /** Vehicle-fit context from the Make → Model flow. */
  make?: string;
  model?: string;
  /** Fine filters. */
  brand?: string;
  /** Market-of-origin regions (china/europe/russia/korea/usa); empty/undefined = all. */
  regions?: string[];
  /** Restrict to GM-family brands (Chevrolet / Ravon / Daewoo …). */
  gmOnly?: boolean;
  /** Restrict to parts carrying an OEM number (server-side `oem_only`). */
  oemOnly?: boolean;
  /** Product kinds (lowercase, e.g. ["motor_oil"]); repeatable, empty = every kind. */
  kinds?: string[];
  /** Motor-oil facet filters. Any of these implies `kind=motor_oil` server-side.
   *  All lists are repeatable query params; `volumesMl` values are in millilitres.
   *  `oilTypes` values are lowercase (`synthetic|semi_synthetic|mineral`). */
  viscosities?: string[];
  oilTypes?: string[];
  volumesMl?: number[];
  /** Volume range in millilitres (inclusive), an alternative to exact `volumesMl`. */
  volumeMlMin?: number;
  volumeMlMax?: number;
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
  if (request.oemOnly) {
    items = items.filter((item) => Boolean(item.oem));
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
// flat `CatalogItem`. The backend strictly rejects unknown query params
// (it 400s on `pageSize`), so every filter below uses the exact param name
// from the live OpenAPI spec (`q`, `category`, `page`, `page_size`, …) —
// see PARTS_PARAM.
type ApiCatalogPart = {
  id: string;
  title: string;
  brand?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  /** Canonical part system, uppercase enum (e.g. "BRAKES", "ENGINE"). */
  main_category?: string;
  /** Product kind — drives which card to render. Oils carry a `motor_oil` block
   *  and a null `part_number_type`. Absent on legacy responses → spare part. */
  kind?: 'SPARE_PART' | 'MOTOR_OIL';
  /** Motor-oil attributes; `null` for spare parts. `*_label` fields are already
   *  localized by the backend — prefer them for display. */
  motor_oil?: {
    viscosity?: string | null;
    oil_type?: string | null;
    oil_type_label?: string | null;
    volume_ml?: number | null;
    volume_label?: string | null;
  } | null;
  /** Universal vs vehicle-specific. The authoritative flag — never inferred from
   *  the category. `true` ⟺ `compatibility` is null and `fits` is empty. */
  is_universal?: boolean;
  /** Vehicle fitments; empty for universal listings. */
  fits?: {
    make_slug?: string;
    make_name?: string;
    model_slug?: string;
    model_name?: string;
  }[];
  /** Denormalized brand label the backend attaches to the part. */
  part_brand_name?: string | null;
  oem_numbers?: string[];
  gm_numbers?: string[];
  /** How the part number is classified ("OEM" | "GM" | "UNKNOWN"). */
  part_number_type?: string;
  price_uzs?: number;
  price_label?: string;
  /** Pre-discount price + the winning campaign, present ONLY when the backend
   *  applied an active sale to this part (`price_uzs` is then the sale price).
   *  See mator.uz `part.presenter.ts`. Absent = full price, no sale. */
  original_price_uzs?: number | null;
  sale?: {
    id?: string;
    title?: string;
    discount_type?: string;
    discount_value?: number;
    /** Effective percent off (whole/2-dp), for the "-15%" pill. */
    discount_percent?: number;
    discount_amount_uzs?: number;
  } | null;
  in_stock?: boolean;
  images?: string[];
  specs?: { label: string; value: string }[];
  features?: string[];
  /** Estimated delivery window in days (either can be null). */
  delivery_eta_days_min?: number | null;
  delivery_eta_days_max?: number | null;
  /** Seller storefront that lists the part. `certified`/`lowest_price` are the
   *  customer-facing mirror of the operator panel's dealer badges (added by the
   *  backend per docs/mator-certified-contract.md; absent until then). */
  seller?: {
    id: string;
    name: string;
    rating_avg?: number;
    certified?: boolean;
    lowest_price?: boolean;
  } | null;
  /** Market of origin, uppercase enum on the live backend ("USA", "KOREA"). */
  origin_region?: string;
  /** Legacy alias some deployments used before `origin_region`. */
  region?: string;
};

/** "BRAKES" / "BRAKE_SYSTEM" → "Brakes" / "Brake system" for display. */
function prettyEnum(v: string): string {
  return v
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Build a spec table from the part's structured fields when the backend
 * doesn't ship an explicit `specs` array — so the detail screen shows real
 * data (brand, origin, OEM/GM numbers, stock, seller) instead of nothing.
 */
/** The single OEM|GM number row for the detail spec table — same GM-xor-OEM
 *  precedence as `resolvePartNumber`, but showing every number of that type. */
function partNumberSpec(p: ApiCatalogPart): CatalogItemSpec | undefined {
  const gm = p.gm_numbers?.length ? p.gm_numbers.join(', ') : undefined;
  const oem = p.oem_numbers?.length ? p.oem_numbers.join(', ') : undefined;
  const type = (p.part_number_type ?? '').toUpperCase();
  if (type === 'GM' && (gm ?? oem)) return { label: 'GM number', value: (gm ?? oem)! };
  if (type === 'OEM' && (oem ?? gm)) return { label: 'OEM number', value: (oem ?? gm)! };
  if (gm) return { label: 'GM number', value: gm };
  if (oem) return { label: 'OEM number', value: oem };
  return undefined;
}

function deriveSpecs(p: ApiCatalogPart): CatalogItemSpec[] {
  const specs: CatalogItemSpec[] = [];
  const brand = p.part_brand_name ?? p.brand?.name;
  if (brand) specs.push({ label: 'Brand', value: brand });
  // Motor-oil attributes — shown as their own spec rows (oils carry no OEM/GM
  // row). Prefer the backend's pre-localized labels; fall back to the raw value.
  const oil = p.motor_oil;
  if (oil) {
    if (oil.viscosity) specs.push({ label: 'Viscosity', value: oil.viscosity });
    const oilType = oil.oil_type_label ?? (oil.oil_type ? prettyEnum(oil.oil_type) : undefined);
    if (oilType) specs.push({ label: 'Oil type', value: oilType });
    const volume =
      oil.volume_label ?? (oil.volume_ml != null ? `${oil.volume_ml} ml` : undefined);
    if (volume) specs.push({ label: 'Volume', value: volume });
  }
  const category = p.main_category ? cleanCategoryName(prettyEnum(p.main_category)) : undefined;
  if (category) specs.push({ label: 'Category', value: category });
  const region = normalizeRegion(p.origin_region ?? p.region);
  const regionLabel = region && CATALOG_REGIONS.find((r) => r.key === region)?.label;
  if (regionLabel) specs.push({ label: 'Origin', value: regionLabel });
  // A part is GM xor OEM — show only the matching number row (the label already
  // conveys the type), never both.
  const partNumber = partNumberSpec(p);
  if (partNumber) specs.push(partNumber);
  return specs;
}

type ApiCatalogPartsResponse = {
  items: ApiCatalogPart[];
  total: number;
  page: number;
  page_size: number;
  next_page: number | null;
};

/**
 * A part carries exactly ONE cross-reference number, tagged by the seller as
 * either OEM or GM — never both. Resolve that single number + its label so the
 * card and detail show the GM pill for a GM part and the OEM pill for an OEM
 * part, and never both at once.
 *
 * Precedence: the explicit `part_number_type` wins (the seller's choice); with
 * no type we fall back to whichever number array is populated (GM first), so a
 * GM part is never mislabeled "OEM".
 */
function resolvePartNumber(p: ApiCatalogPart): { oem?: string; gm?: string } {
  const gm = p.gm_numbers?.[0];
  const oem = p.oem_numbers?.[0];
  const type = (p.part_number_type ?? '').toUpperCase();
  if (type === 'GM') return { gm: gm ?? oem };
  if (type === 'OEM') return { oem: oem ?? gm };
  if (gm) return { gm };
  if (oem) return { oem };
  return {};
}

type OilType = 'SYNTHETIC' | 'SEMI_SYNTHETIC' | 'MINERAL';

/** Narrow the raw `oil_type` string to the three known enum values (else drop
 *  it — the label carries the display text anyway). */
function narrowOilType(v: string | null | undefined): OilType | undefined {
  const up = (v ?? '').toUpperCase();
  return up === 'SYNTHETIC' || up === 'SEMI_SYNTHETIC' || up === 'MINERAL' ? up : undefined;
}

function mapPartToCatalogItem(p: ApiCatalogPart): CatalogItem {
  const partNumber = resolvePartNumber(p);
  return {
    id: p.id,
    status: p.in_stock === false ? 'Out of stock' : 'In stock',
    title: p.title,
    description: [p.brand?.name, cleanCategoryName(p.category?.name)].filter(Boolean).join(' · '),
    price:
      p.price_label ??
      (p.price_uzs != null ? `UZS' ${p.price_uzs.toLocaleString('ru-RU')}` : ''),
    priceUzs: p.price_uzs ?? undefined,
    priceLabel: '',
    images: p.images ?? [],
    // Prefer an explicit spec array; otherwise synthesize one from the
    // part's structured fields so the detail screen isn't blank.
    specs: p.specs?.length ? p.specs : deriveSpecs(p),
    features: p.features ?? [],
    category: cleanCategoryName(p.category?.name) ?? '',
    brand: p.part_brand_name ?? p.brand?.name ?? undefined,
    // Exactly one of these is ever set — a part is GM xor OEM (see resolvePartNumber).
    oem: partNumber.oem,
    gm: partNumber.gm,
    deliveryEtaMinDays: p.delivery_eta_days_min ?? undefined,
    deliveryEtaMaxDays: p.delivery_eta_days_max ?? undefined,
    // Prefer the backend's tagged origin (`origin_region`, uppercase enum),
    // then the legacy `region` alias, then brand inference.
    region: normalizeRegion(p.origin_region ?? p.region) ?? brandRegion(p.brand?.name),
    // Trust badges — mirror the seller flags the operator panel toggles. Default
    // off; light up automatically the moment the backend ships the fields.
    certified: p.seller?.certified === true,
    lowestPrice: p.seller?.lowest_price === true,
    sellerName: p.seller?.name ?? undefined,
    // Raw ids the client sale matcher needs to resolve CATEGORIES / DEALERS-scoped
    // campaigns (see services/sales-service.ts) — the fallback when the backend
    // hasn't applied the sale itself.
    categoryId: p.category?.id ?? undefined,
    sellerId: p.seller?.id ?? undefined,
    // Backend-resolved sale (authoritative). `price_uzs` is already the sale
    // price here, so `original_price_uzs` is the struck-through was.
    salePercent:
      p.sale && typeof p.sale.discount_percent === 'number'
        ? p.sale.discount_percent
        : undefined,
    originalPriceUzs: p.original_price_uzs ?? undefined,
    // Motor-oil shape — `kind` drives the card; `isUniversal` drives the
    // "Подходит для всех" treatment (never inferred from the category name).
    kind: p.kind,
    motorOil: p.motor_oil
      ? {
          viscosity: p.motor_oil.viscosity ?? undefined,
          oilType: narrowOilType(p.motor_oil.oil_type),
          oilTypeLabel: p.motor_oil.oil_type_label ?? undefined,
          volumeMl: p.motor_oil.volume_ml ?? undefined,
          volumeLabel: p.motor_oil.volume_label ?? undefined,
        }
      : undefined,
    isUniversal: p.is_universal === true,
    fits: (p.fits ?? []).map((f) => ({
      makeSlug: f.make_slug ?? undefined,
      makeName: f.make_name ?? undefined,
      modelSlug: f.model_slug ?? undefined,
      modelName: f.model_name ?? undefined,
    })),
  };
}

// Query-param names for GET /v1/catalog/parts. The backend STRICTLY rejects
// unknown params (400 on `pageSize`), so these must match the backend's
// Swagger exactly. Verified against the live spec at `/docs-json` (2026-07-26):
// `q`, `category`, `page`, `page_size`, `make`, `model`, `brand`, `region`,
// `gm_only`, `sort`, plus the motor-oil filters `kind`, `viscosity`, `oil_type`,
// `volume_ml`. If a filter 400s, correct the value here — this is the single
// source of truth.
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
  oemOnly: 'oem_only',
  sort: 'sort',
  kind: 'kind',
  viscosity: 'viscosity',
  oilType: 'oil_type',
  volumeMl: 'volume_ml',
  volumeMlMin: 'volume_ml_min',
  volumeMlMax: 'volume_ml_max',
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
    if (request.oemOnly) params.set(PARTS_PARAM.oemOnly, 'true');
    if (request.sortBy) params.set(PARTS_PARAM.sort, request.sortBy);
    // Motor-oil filters — every list is a repeatable query param (kind, viscosity,
    // oil_type, volume_ml). Any of these makes the backend imply kind=motor_oil,
    // so they compose without an explicit kind. `volume_ml_*` is the range form.
    request.kinds?.forEach((k) => params.append(PARTS_PARAM.kind, k));
    request.viscosities?.forEach((v) => params.append(PARTS_PARAM.viscosity, v));
    request.oilTypes?.forEach((t) => params.append(PARTS_PARAM.oilType, t));
    request.volumesMl?.forEach((v) => params.append(PARTS_PARAM.volumeMl, String(v)));
    if (request.volumeMlMin != null) params.set(PARTS_PARAM.volumeMlMin, String(request.volumeMlMin));
    if (request.volumeMlMax != null) params.set(PARTS_PARAM.volumeMlMax, String(request.volumeMlMax));
    const res = await apiClient.get<ApiCatalogPartsResponse>(
      `${API_BASE}/parts?${params.toString()}`,
      { signal: request.signal },
    );
    return {
      // Guard against a response without an `items` array (empty page / error
      // body) so a filled catalog can't crash the listing.
      items: (res.items ?? []).map(mapPartToCatalogItem),
      total: res.total ?? 0,
      page: res.page ?? request.page,
      pageSize: res.page_size ?? request.pageSize,
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
