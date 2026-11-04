// ── Types ────────────────────────────────────────────────────────────

import {
  brandRegion,
  isGmBrand,
  normalizeRegion,
  type CatalogRegion,
} from '@/constants/catalog-regions';
import { cleanCategoryName } from '@/utils/category-label';
import { formatSomAmount } from '@/utils/format-price';
import { normalizePartTitle } from '@/utils/part-title';

export type CatalogItem = {
  id: string;
  /** Optional corner-ribbon label ("Hot pick", "New"). Items without
   *  a badge render with no ribbon. "Featured" and "Premium" were
   *  retired — don't reintroduce them. */
  badge?: string;
  status: string;
  /** Display title, normalized at the API boundary by `normalizePartTitle` —
   *  de-shouted, edge junk stripped, qualifiers lifted into `titleDetail`.
   *  Sellers type titles freehand, so the raw value is not presentable. */
  title: string;
  /** The qualifiers that were buried in the raw title (vehicle model, side,
   *  spec code, volume), joined with " · ". Rendered as a secondary line under
   *  the title; absent when the title had nothing to lift. */
  titleDetail?: string;
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
   *  `description`). The Brand filter is the backend's, by brand id — see
   *  `CatalogListRequest.brands`. */
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
  /** Real review aggregate (`rating_avg` / `review_count`). Both absent until
   *  the part has been reviewed — surfaces must render NOTHING rather than a
   *  placeholder score. */
  rating?: number;
  reviewCount?: number;
  /** Ops-flagged bestseller (`is_bestseller`), drives the "Bestseller" chip. */
  bestseller?: boolean;
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
  /** Backend-formatted pre-discount price, when a sale applies. */
  originalPriceLabel?: string;
  /** Name of the campaign behind the discount ("Осенняя распродажа"). */
  saleTitle?: string;
  /** Product kind. "MOTOR_OIL" and "ANTIFREEZE" listings carry their own
   *  attribute block (and no OEM/GM row — the backend sends a null
   *  `part_number_type` for a kind that has no part-number concept);
   *  "SPARE_PART" is the default. Absent → treat as a spare part. */
  kind?: 'SPARE_PART' | 'MOTOR_OIL' | 'ANTIFREEZE';
  /** The unit a listing is quantified in, from the backend's kind capability
   *  table — 'PCS' | 'L' | 'KG'. A property of the KIND, never of the listing:
   *  antifreeze is sold by the kilogram however the seller filed it. Carried so
   *  no surface ever hardcodes "шт" for a product that isn't sold by the piece. */
  unit?: 'PCS' | 'L' | 'KG';
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
  /** Antifreeze attributes — present only for `kind === "ANTIFREEZE"`. The
   *  weight is the NET package weight in grams (exact + sortable), with the
   *  backend's own "2.5 кг" rendering beside it; prefer the label for display. */
  antifreeze?: {
    weightG?: number;
    /** Pre-formatted (e.g. "2.5 кг"). */
    weightLabel?: string;
  } | null;
  /** True for universal listings (oils under "Другое"). Universal parts render
   *  "Подходит для всех" and NEVER a compatibility badge — `fits` is empty and
   *  the backend deliberately returns a null compatibility. The single source of
   *  truth for universal vs vehicle-specific; never infer from the category name. */
  isUniversal?: boolean;
  /** Make-level fitment — the part fits EVERY model of these makes. A part can
   *  carry these, per-model `fits`, or both; a listing with ONLY make fitment
   *  used to render an empty "Fits" section. */
  makeFits?: {
    makeSlug?: string;
    makeName?: string;
  }[];
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
  /**
   * Top-level vehicle-system bucket (`BRAKE_SYSTEM`, `MAINTENANCE_AND_FLUIDS`,
   * …) — the taxonomy the home grid browses.
   *
   * It is a SEPARATE axis from `category`: `category` matches one exact leaf
   * ("air-filters"), while this rolls up every leaf in the system. The backend
   * ignores an unknown value rather than erroring, so only send ids that came
   * from `/v1/categories?scope=vehicle`.
   */
  vehicleCategory?: string;
  search?: string | null;
  sortBy?: 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'relevance' | 'bestseller';
  /** Vehicle-fit context from the Make → Model flow. */
  make?: string;
  model?: string;
  /** Part brands to list: brand ids (`brand_gates`) as `brandFacets` hands
   *  them out; empty/undefined = every brand. The backend applies them before
   *  it counts and pages, so `total` and the pages cover the whole catalogue
   *  of those brands, not the rows already loaded. */
  brands?: string[];
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

/** A part brand a listing offers (`facets.brands` of GET /v1/catalog/parts):
 *  its id — what `CatalogListRequest.brands` takes — its name, and how many
 *  parts of the WHOLE result carry it, not just the page's. */
export type CatalogBrandFacet = {
  id: string;
  name: string;
  count: number;
};

export type CatalogListResponse = {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  /** The page after this one, or null on the last page (the backend's
   *  `next_page`). */
  nextPage: number | null;
  /** Every part brand the request's other filters leave, with its count. The
   *  backend counts it without the request's own `brands`, so a picked brand
   *  keeps the others on offer. Empty from a backend that sends no facets. */
  brandFacets: CatalogBrandFacet[];
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
  /** `name` is the backend's INTERNAL canonical (English) category name —
   *  never rendered. `label` is already resolved for the request's
   *  `Accept-Language`; it's what the card shows. `label` is absent until the
   *  backend's category-i18n migration lands, so display falls back to `name`. */
  category?: {
    id: string;
    name: string;
    label?: string;
    name_ru?: string;
    name_uz?: string;
    name_en?: string;
  } | null;
  /** Canonical part system, uppercase enum (e.g. "BRAKES", "ENGINE"). */
  main_category?: string;
  /** Product kind — drives which card to render. Oils and antifreeze carry
   *  their own attribute block and a null `part_number_type`. Absent on legacy
   *  responses → spare part. */
  kind?: 'SPARE_PART' | 'MOTOR_OIL' | 'ANTIFREEZE';
  /** Unit of sale for this kind ('PCS' | 'L' | 'KG'), from the backend's kind
   *  capability table. */
  unit?: 'PCS' | 'L' | 'KG' | null;
  /** Motor-oil attributes; `null` for spare parts. `*_label` fields are already
   *  localized by the backend — prefer them for display. */
  motor_oil?: {
    viscosity?: string | null;
    oil_type?: string | null;
    oil_type_label?: string | null;
    volume_ml?: number | null;
    volume_label?: string | null;
  } | null;
  /** Antifreeze attributes; `null` for every other kind. `weight_g` is the net
   *  package weight in GRAMS, `weight_label` its pre-formatted rendering. */
  antifreeze?: {
    weight_g?: number | null;
    weight_label?: string | null;
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
  /** Make-level fitment: the part fits EVERY model of these makes (an imported
   *  dealer position whose source names a make but no model). Separate from
   *  `fits`, which is one entry per model — a part can have either or both. */
  make_fits?: {
    make_slug?: string;
    make_name?: string;
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
  /** Pre-formatted pre-discount price ("UZS 44 000"), beside the numeric one. */
  original_price_label?: string | null;
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
  /** Review aggregate. `rating_avg` is null until a part has been reviewed —
   *  the card shows stars ONLY when it is a real number, never a stand-in. */
  rating_avg?: number | null;
  review_count?: number | null;
  /** Seller/ops-flagged bestseller, mirrored from the operator panel. */
  is_bestseller?: boolean;
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

type ApiCatalogPartsResponse = {
  items: ApiCatalogPart[];
  total: number;
  page: number;
  page_size: number;
  /** Absent from an older backend — derived from the paging numbers then. */
  next_page?: number | null;
  /** Counted over the whole result. `brands` holds every part brand the other
   *  filters leave — the request's own `brand` ignored — by brand id. */
  facets?: {
    brands?: { id: string | null; name: string; count: number }[] | null;
  } | null;
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
export function resolvePartNumber(
  p: Pick<ApiCatalogPart, 'gm_numbers' | 'oem_numbers' | 'part_number_type'>,
): { oem?: string; gm?: string } {
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
  // Seller-entered titles arrive SHOUTED, with trailing punctuation, the car
  // model glued on the end, spec codes run together with the name, or the brand
  // repeated. Normalizing HERE (the single mapper every catalog surface goes
  // through) is what makes the grid, row, detail, cart and order agree.
  const partBrand = p.part_brand_name ?? p.brand?.name ?? undefined;
  const titleParts = normalizePartTitle(p.title, { brand: partBrand });
  // Placeholder detection runs on the INTERNAL English `name` (the sentinel is
  // an English backend value, so a localized label would never match), but what
  // we render is the server-localized `label`. Pre-migration `label` is absent
  // and this degrades to exactly the old behaviour.
  const cleanedCategoryName = cleanCategoryName(p.category?.name);
  const categoryLabel = cleanedCategoryName
    ? // `||` not `??`: an empty/whitespace label must fall through to the name
      // rather than blank the card's subtitle.
      p.category?.label?.trim() || cleanedCategoryName
    : undefined;
  return {
    id: p.id,
    status: p.in_stock === false ? 'Out of stock' : 'In stock',
    // Fall back to the raw title if normalization emptied it (a title of pure
    // punctuation) — a row must never render a blank name.
    title: titleParts.title || p.title,
    titleDetail: titleParts.detail,
    description: [p.brand?.name, categoryLabel].filter(Boolean).join(' · '),
    price:
      // `price_label` is the backend's pre-formatted string; the fallback below
      // only fires when it's absent. (It used to emit a stray apostrophe —
      // "UZS' 38 661".) The label rounds to whole som, so a fractional price is
      // formatted from the amount the order will actually charge.
      typeof p.price_uzs === 'number' && !Number.isInteger(p.price_uzs)
        ? `UZS ${formatSomAmount(p.price_uzs)}`
        : p.price_label ?? (p.price_uzs != null ? `UZS ${p.price_uzs.toLocaleString('ru-RU')}` : ''),
    priceUzs: p.price_uzs ?? undefined,
    priceLabel: '',
    images: p.images ?? [],
    // The detail screen only reads the oil/antifreeze rows off `motorOil` /
    // `antifreeze` now — brand/category/origin/OEM/GM live in the OEM pill
    // and the title instead. Kept passthrough-only for whatever the backend
    // sends explicitly, rather than synthesizing the retired generic rows.
    specs: p.specs ?? [],
    features: p.features ?? [],
    category: categoryLabel ?? '',
    brand: partBrand,
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
    // Reviews are real or absent. `rating_avg` is null for an unreviewed part,
    // and a 0 average means "no score" — neither may become a rendered number.
    rating: typeof p.rating_avg === 'number' && p.rating_avg > 0 ? p.rating_avg : undefined,
    reviewCount:
      typeof p.review_count === 'number' && p.review_count > 0 ? p.review_count : undefined,
    bestseller: p.is_bestseller === true,
    sellerName: p.seller?.name ?? undefined,
    // Raw ids the client sale matcher needs to resolve CATEGORIES / DEALERS-scoped
    // campaigns (see services/sales-service.ts) — the fallback when the backend
    // hasn't applied the sale itself.
    categoryId: p.category?.id ?? undefined,
    sellerId: p.seller?.id ?? undefined,
    // Backend-resolved sale (authoritative). `price_uzs` is already the sale
    // price here, so `original_price_uzs` is the struck-through was.
    salePercent:
      p.sale && typeof p.sale.discount_percent === 'number' ? p.sale.discount_percent : undefined,
    originalPriceUzs: p.original_price_uzs ?? undefined,
    // The backend's own formatting of the struck-through "was" — preferred over
    // reformatting the number client-side, so the two never disagree.
    originalPriceLabel: p.original_price_label ?? undefined,
    // Campaign name ("Осенняя распродажа"), shown beside the discount pill.
    saleTitle: p.sale?.title?.trim() || undefined,
    // Motor-oil shape — `kind` drives the card; `isUniversal` drives the
    // "Подходит для всех" treatment (never inferred from the category name).
    kind: p.kind,
    // Unit of sale, straight from the backend's kind capability table. Carried
    // so a quantity is never rendered (or fiscalized) as "шт" for a kind sold
    // by the litre or kilogram.
    unit: p.unit ?? undefined,
    motorOil: p.motor_oil
      ? {
          viscosity: p.motor_oil.viscosity ?? undefined,
          oilType: narrowOilType(p.motor_oil.oil_type),
          oilTypeLabel: p.motor_oil.oil_type_label ?? undefined,
          volumeMl: p.motor_oil.volume_ml ?? undefined,
          volumeLabel: p.motor_oil.volume_label ?? undefined,
        }
      : undefined,
    antifreeze: p.antifreeze
      ? {
          weightG: p.antifreeze.weight_g ?? undefined,
          weightLabel: p.antifreeze.weight_label ?? undefined,
        }
      : undefined,
    isUniversal: p.is_universal === true,
    makeFits: (p.make_fits ?? []).map((f) => ({
      makeSlug: f.make_slug ?? undefined,
      makeName: f.make_name ?? undefined,
    })),
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
  vehicleCategory: 'vehicle_category',
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
    if (request.vehicleCategory) {
      params.set(PARTS_PARAM.vehicleCategory, request.vehicleCategory);
    }
    if (request.make) params.set(PARTS_PARAM.make, request.make);
    if (request.model) params.set(PARTS_PARAM.model, request.model);
    // Brands go as ONE comma-separated `brand` (brand=brand_bosch,brand_mann):
    // that is the backend's contract, and a repeated `brand=` fails its
    // single-string validation with a 400.
    if (request.brands?.length) params.set(PARTS_PARAM.brand, request.brands.join(','));
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
    if (request.volumeMlMin != null)
      params.set(PARTS_PARAM.volumeMlMin, String(request.volumeMlMin));
    if (request.volumeMlMax != null)
      params.set(PARTS_PARAM.volumeMlMax, String(request.volumeMlMax));
    const res = await apiClient.get<ApiCatalogPartsResponse>(
      `${API_BASE}/parts?${params.toString()}`,
      { signal: request.signal },
    );
    const total = res.total ?? 0;
    const page = res.page ?? request.page;
    const pageSize = res.page_size ?? request.pageSize;
    return {
      // Guard against a response without an `items` array (empty page / error
      // body) so a filled catalog can't crash the listing.
      items: (res.items ?? []).map(mapPartToCatalogItem),
      total,
      page,
      pageSize,
      nextPage: res.next_page !== undefined ? res.next_page : nextPageOf(page, pageSize, total),
      // A brand the response cannot name an id for cannot be filtered on.
      brandFacets: (res.facets?.brands ?? []).flatMap((b) =>
        b.id ? [{ id: b.id, name: b.name || b.id, count: b.count ?? 0 }] : [],
      ),
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

/** The page after `page`, or null when it is the last — the backend's rule. */
function nextPageOf(page: number, pageSize: number, total: number): number | null {
  return page * pageSize < total ? page + 1 : null;
}
