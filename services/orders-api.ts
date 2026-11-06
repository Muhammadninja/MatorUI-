/**
 * Transport contract for the orders + account-data APIs. Implement once
 * for the mock environment (`MockOrdersTransport`, below), once for
 * HTTP (stub at the bottom of this file), and swap by reassigning the
 * `ordersTransport` constant.
 *
 * Mirrors `garage-api.ts` / `cart-api.ts`: same singleton-swap pattern,
 * same AbortSignal contract on reads, same "no client-side cancel on
 * mutations" stance (an aborted mutation may already be committed
 * server-side; silent local cancel would mask that).
 */
import type {
  Address,
  AddressInput,
  AddressSearchQuery,
  AddressSuggestion,
  AddressSuggestions,
  CreateOrderInput,
  DeliveryCoverageInfo,
  DeliveryPoint,
  CreateOrderResult,
  OrderCharges,
  OrderDetail,
  OrderListPage,
  OrderListRow,
  OrderListStatus,
  OrderStatus,
  PaymentMethod,
  PaymentMethodInput,
  PaymentType,
  PointDescription,
  ShippingOption,
} from '@/services/orders-service';

export type OrderListRequest = {
  page?: number;
  pageSize?: number;
  /** Optional server-side filter by status pill. */
  status?: OrderListStatus;
};

export type ShippingQuoteRequest = {
  addressId: string;
  /** Neither is sent, since the server reads its own saved address and cart. They are
   *  here so that a change to the address's location or to the cart's lines asks again. */
  location?: string;
  cartKey?: string;
};

export interface OrdersTransport {
  listOrders(request: OrderListRequest, signal?: AbortSignal): Promise<OrderListPage>;
  getOrder(orderId: string, signal?: AbortSignal): Promise<OrderDetail | null>;
  createOrder(input: CreateOrderInput, signal?: AbortSignal): Promise<CreateOrderResult>;
  listAddresses(signal?: AbortSignal): Promise<Address[]>;
  searchAddresses(query: AddressSearchQuery, signal?: AbortSignal): Promise<AddressSuggestions>;
  /** Asked once for a point the buyer has confirmed, never while the map moves. */
  describePoint(point: DeliveryPoint, lang: string, signal?: AbortSignal): Promise<PointDescription>;
  getDeliveryCoverage(signal?: AbortSignal): Promise<DeliveryCoverageInfo>;
  createAddress(input: AddressInput): Promise<Address>;
  updateAddress(id: string, input: AddressInput): Promise<Address>;
  removeAddress(id: string): Promise<void>;
  setDefaultAddress(id: string): Promise<void>;
  listPaymentMethods(signal?: AbortSignal): Promise<PaymentMethod[]>;
  createPaymentMethod(input: PaymentMethodInput): Promise<PaymentMethod>;
  updatePaymentMethod(id: string, input: PaymentMethodInput): Promise<PaymentMethod>;
  removePaymentMethod(id: string): Promise<void>;
  setDefaultPaymentMethod(id: string): Promise<void>;
  getShippingQuote(
    request: ShippingQuoteRequest,
    signal?: AbortSignal,
  ): Promise<ShippingOption[]>;
}

// ── Mock transport ───────────────────────────────────────────────────

const MOCK_LATENCY_MS = 250;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
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

const SEED_ADDRESSES: Address[] = [
  {
    id: 'addr_home',
    label: 'Home',
    name: 'Alex Marino',
    line1: '128 Marrakesh Rd, Suite 4',
    city: 'Brooklyn, NY 11211',
    isDefault: true,
    lat: 41.3111,
    lng: 69.2797,
  },
  {
    id: 'addr_shop',
    label: 'Shop',
    name: 'Alex Marino',
    line1: '2210 W Industrial Blvd',
    city: 'Long Island City, NY 11101',
    isDefault: false,
    lat: 41.3385,
    lng: 69.3345,
  },
];

const SEED_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm_mc_4242', brand: 'Mastercard', last4: '4242', exp: '09/27', isDefault: true },
  { id: 'pm_visa_1881', brand: 'Visa', last4: '1881', exp: '03/26', isDefault: false },
];

// Mock only: the real price comes from the backend's quote, per address and seller.
const MOCK_COURIER_PRICE_UZS = 15_000;

// Mock only: the real matches come from the backend's address search.
const MOCK_ADDRESS_SUGGESTIONS: AddressSuggestion[] = [
  {
    id: 'mock_1',
    title: 'Amir Temur 12',
    subtitle: 'Yunusobod, Toshkent',
    city: 'Toshkent',
    district: 'Yunusobod',
    street: 'Amir Temur',
    houseNumber: '12',
    lat: 41.3111,
    lng: 69.2797,
  },
  {
    id: 'mock_2',
    title: 'Navoiy 5',
    subtitle: 'Shayxontohur, Toshkent',
    city: 'Toshkent',
    district: 'Shayxontohur',
    street: 'Navoiy',
    houseNumber: '5',
    lat: 41.3225,
    lng: 69.2391,
  },
];

function detailFor(row: { id: string; total: string }, statusKey: 'in_transit' | 'delivered' | 'cancelled'): OrderDetail {
  const isInTransit = statusKey === 'in_transit';
  return {
    id: row.id,
    status: isInTransit ? 'out_for_delivery' : statusKey === 'delivered' ? 'delivered' : 'cancelled',
    statusLabel: isInTransit ? 'Out for delivery' : statusKey === 'delivered' ? 'Delivered' : 'Cancelled',
    etaWindow: isInTransit ? '14:30 - 15:00' : 'Delivered',
    placedAt: 'Jun 4, 2026',
    currentStepIndex: isInTransit ? 3 : statusKey === 'delivered' ? 4 : 0,
    steps: [
      { key: 'placed', label: 'Order placed', caption: 'Tue · 9:42 AM' },
      { key: 'packed', label: 'Packed', caption: 'Tue · 4:11 PM' },
      { key: 'shipped', label: 'Shipped', caption: 'Wed · 7:28 AM' },
      { key: 'out_for_delivery', label: 'Out for delivery', caption: 'Today · 8:15 AM' },
      { key: 'delivered', label: 'Delivered', caption: isInTransit ? 'ETA 14:30 - 15:00' : 'Today · 14:42' },
    ],
    destination: SEED_ADDRESSES[0]!,
    courier: isInTransit
      ? {
          name: 'Marcus L.',
          company: 'Speedline Express',
          vehicle: 'Ford Transit · 8KJ-2491',
          rating: 4.9,
        }
      : null,
    items: [
      { id: 'p1', title: 'Turbo Wheel Set', quantity: 1, price: '$1,240' },
      { id: 'p2', title: 'Street Brake Pack', quantity: 1, price: '$760' },
    ],
    totalLabel: row.total,
  };
}

/** Optional seed data for the mock. The app constructs `new MockOrdersTransport()`
 *  (all-empty) so screens render their real empty states; tests pass `MOCK_SEED`
 *  to exercise the account-collection read paths. Orders themselves are no longer
 *  seeded — real orders come from the HTTP transport (`GET /v1/orders`). */
export type MockOrdersSeed = {
  orders?: OrderListPage;
  details?: Record<string, OrderDetail>;
  addresses?: Address[];
  paymentMethods?: PaymentMethod[];
};

/** Account-collection fixture set — for tests only (orders are not seeded). */
export const MOCK_SEED: MockOrdersSeed = {
  addresses: SEED_ADDRESSES,
  paymentMethods: SEED_PAYMENT_METHODS,
};

export class MockOrdersTransport implements OrdersTransport {
  private orders: OrderListPage;
  private details: Record<string, OrderDetail>;
  // Instance copies so CRUD mutations don't leak into the module seeds
  // (mirrors how `orders`/`details` are cloned above).
  private addresses: Address[];
  private paymentMethods: PaymentMethod[];

  constructor(seed?: MockOrdersSeed) {
    // Default: start with NO orders / addresses / payment methods — screens show
    // their real empty states instead of mock data. Real data comes from the HTTP
    // transport (GET /v1/orders, /v1/account/*) when the `orders` domain is
    // enabled. Tests pass `MOCK_SEED` to populate the read paths.
    this.orders = seed?.orders
      ? { ...seed.orders, items: seed.orders.items.map((o) => ({ ...o })) }
      : { page: 1, pageSize: 20, total: 0, items: [] };
    this.details = { ...(seed?.details ?? {}) };
    this.addresses = seed?.addresses ? seed.addresses.map((a) => ({ ...a })) : [];
    this.paymentMethods = seed?.paymentMethods ? seed.paymentMethods.map((p) => ({ ...p })) : [];
  }

  async listOrders(
    request: OrderListRequest,
    signal?: AbortSignal,
  ): Promise<OrderListPage> {
    await delay(MOCK_LATENCY_MS, signal);
    const filtered = request.status
      ? this.orders.items.filter((o) => o.status === request.status)
      : this.orders.items;
    const page = request.page ?? 1;
    const pageSize = request.pageSize ?? this.orders.pageSize;
    const start = (page - 1) * pageSize;
    return {
      page,
      pageSize,
      total: filtered.length,
      items: filtered.slice(start, start + pageSize),
    };
  }

  async getOrder(orderId: string, signal?: AbortSignal): Promise<OrderDetail | null> {
    await delay(MOCK_LATENCY_MS, signal);
    return this.details[orderId] ?? null;
  }

  async createOrder(
    input: CreateOrderInput,
    _signal?: AbortSignal,
  ): Promise<CreateOrderResult> {
    await delay(MOCK_LATENCY_MS);
    if (input.items.length === 0) {
      throw new Error('Cart is empty');
    }
    const orderId = `M-${Math.floor(40000 + Math.random() * 60000)}`;
    const eta = input.shippingOptionKey === 'pickup' ? 'Today' : '1-3 days';
    // Real server calculates this authoritatively; the mock echoes the
    // client's optimistic grand-total hint so the just-placed order's
    // confirmation + track screens show a real total instead of a blank.
    const totalLabel = input.totalLabel ?? '$—.—';
    // Seed a new detail row so a subsequent track-order fetch resolves.
    this.details[orderId] = {
      ...detailFor({ id: orderId, total: totalLabel }, 'in_transit'),
      status: 'placed',
      statusLabel: 'Processing',
      currentStepIndex: 0,
    };
    return { orderId, eta, totalLabel };
  }

  async listAddresses(signal?: AbortSignal): Promise<Address[]> {
    await delay(MOCK_LATENCY_MS, signal);
    return this.addresses.map((a) => ({ ...a }));
  }

  async searchAddresses(
    query: AddressSearchQuery,
    signal?: AbortSignal,
  ): Promise<AddressSuggestions> {
    await delay(MOCK_LATENCY_MS, signal);
    const typed = query.street.trim().toLowerCase();
    return {
      items: MOCK_ADDRESS_SUGGESTIONS.filter((s) => s.title.toLowerCase().includes(typed)),
      attribution: null,
    };
  }

  async describePoint(
    _point: DeliveryPoint,
    _lang: string,
    signal?: AbortSignal,
  ): Promise<PointDescription> {
    await delay(MOCK_LATENCY_MS, signal);
    return { address: null, withinCoverage: true, attribution: null };
  }

  async getDeliveryCoverage(signal?: AbortSignal): Promise<DeliveryCoverageInfo> {
    await delay(MOCK_LATENCY_MS, signal);
    return { configured: true, bounds: null, polygons: null };
  }

  async createAddress(input: AddressInput): Promise<Address> {
    await delay(MOCK_LATENCY_MS);
    // First address becomes the default; otherwise defer to setDefault.
    const isDefault = this.addresses.length === 0;
    const created: Address = {
      id: `addr_${Date.now().toString(36)}`,
      ...input,
      isDefault,
    };
    this.addresses.push(created);
    return { ...created };
  }

  async updateAddress(id: string, input: AddressInput): Promise<Address> {
    await delay(MOCK_LATENCY_MS);
    const idx = this.addresses.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Address not found');
    const updated: Address = { ...this.addresses[idx]!, ...input };
    this.addresses[idx] = updated;
    return { ...updated };
  }

  async removeAddress(id: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    const removed = this.addresses.find((a) => a.id === id);
    this.addresses = this.addresses.filter((a) => a.id !== id);
    // Removing the default promotes the first remaining address.
    if (removed?.isDefault && this.addresses.length > 0) {
      this.addresses[0] = { ...this.addresses[0]!, isDefault: true };
    }
  }

  async setDefaultAddress(id: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    // Enforce a single default across the collection.
    this.addresses = this.addresses.map((a) => ({ ...a, isDefault: a.id === id }));
  }

  async listPaymentMethods(signal?: AbortSignal): Promise<PaymentMethod[]> {
    await delay(MOCK_LATENCY_MS, signal);
    return this.paymentMethods.map((p) => ({ ...p }));
  }

  async createPaymentMethod(input: PaymentMethodInput): Promise<PaymentMethod> {
    await delay(MOCK_LATENCY_MS);
    const isDefault = this.paymentMethods.length === 0;
    const created: PaymentMethod = {
      id: `pm_${Date.now().toString(36)}`,
      ...input,
      isDefault,
    };
    this.paymentMethods.push(created);
    return { ...created };
  }

  async updatePaymentMethod(id: string, input: PaymentMethodInput): Promise<PaymentMethod> {
    await delay(MOCK_LATENCY_MS);
    const idx = this.paymentMethods.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Payment method not found');
    const updated: PaymentMethod = { ...this.paymentMethods[idx]!, ...input };
    this.paymentMethods[idx] = updated;
    return { ...updated };
  }

  async removePaymentMethod(id: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    const removed = this.paymentMethods.find((p) => p.id === id);
    this.paymentMethods = this.paymentMethods.filter((p) => p.id !== id);
    if (removed?.isDefault && this.paymentMethods.length > 0) {
      this.paymentMethods[0] = { ...this.paymentMethods[0]!, isDefault: true };
    }
  }

  async setDefaultPaymentMethod(id: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    this.paymentMethods = this.paymentMethods.map((p) => ({
      ...p,
      isDefault: p.id === id,
    }));
  }

  async getShippingQuote(
    request: ShippingQuoteRequest,
    signal?: AbortSignal,
  ): Promise<ShippingOption[]> {
    await delay(MOCK_LATENCY_MS, signal);
    // Refuses like the real backend does, so the screen's error state can be exercised.
    const address = this.addresses.find((a) => a.id === request.addressId);
    if (address?.lat == null || address.lng == null) {
      throw new ApiError(
        422,
        'DELIVERY_ADDRESS_COORDINATES_MISSING',
        'This delivery address has no location.',
      );
    }
    return [
      {
        key: 'courier',
        label: 'Courier',
        price: MOCK_COURIER_PRICE_UZS,
        quoteId: `mock_quote_${request.addressId}`,
      },
    ];
  }
}

// ── HTTP transport (stub) ────────────────────────────────────────────

/**
 * Drop-in HTTP transport — fill in the `request` method with the
 * auth-header strategy from UserContext + env base URL.
 *
 *   GET    /v1/orders?page=&pageSize=&status=     → OrderListPage
 *   GET    /v1/orders/:orderId                    → OrderDetail
 *   POST   /v1/orders                              → CreateOrderResult
 *   GET    /v1/account/addresses                   → Address[]
 *   GET    /v1/addresses/suggestions?street=&house=&city=&lang=&mode=&near_lat=&near_lng=
 *                                                  → { items, attribution }
 *   GET    /v1/addresses/reverse?lat=&lng=&lang=   → { address, within_coverage, attribution }
 *   GET    /v1/shipping/coverage                   → { configured, bounds, geometry }
 *   POST   /v1/addresses                            → Address
 *   PATCH  /v1/addresses/:id                        → Address
 *   DELETE /v1/addresses/:id                        → 204
 *   POST   /v1/addresses/:id/default                → 204
 *   GET    /v1/account/payment-methods             → PaymentMethod[]
 *   POST   /v1/payment-methods                      → PaymentMethod
 *   PATCH  /v1/payment-methods/:id                  → PaymentMethod
 *   DELETE /v1/payment-methods/:id                  → 204
 *   POST   /v1/payment-methods/:id/default          → 204
 *   POST   /v1/shipping/quote                      → { options: [{ type, label,
 *          price_uzs, quote_id }], currency }  — NOT a bare array, and the request body is
 *          `{ delivery_address_id, delivery_method: 'courier' }` (snake_case). Refusals
 *          carry a `code` the checkout words itself (checkout-presentation.ts).
 */
import { shouldUseHttpTransport } from '@/config/api';
import { apiClient, ApiError } from '@/services/api-client';
import { formatCurrency } from '@/services/cart-math';
import { debugLog } from '@/services/debug-log';
import { parseCoverageGeometry } from '@/services/delivery-coverage';

/** Strip spaces / dashes / parens so "+998 90 123 45 67" → "+998901234567". */
function toE164(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

/**
 * Backend address shape (from the live OpenAPI `/docs-json` → CreateAddressDto /
 * address entity, verified 2026-07-23). The wire model is UZ-centric and totally
 * different from the app's `{ label, line1, city }`: an address needs `full_text` or
 * `lat`+`lng`; `line1`/`city`/`name` do not exist (sending them → 400 "property X
 * should not exist" on the strict `forbidNonWhitelisted` DTO).
 */
type RawAddress = {
  id: string;
  label?: string | null;
  region_code?: string | null;
  district?: string | null;
  street?: string | null;
  full_text?: string | null;
  landmark?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_default?: boolean | null;
};

/**
 * Map the app's address (`line1` = street and house, `city` = city line) onto the
 * backend `CreateAddressDto`. `full_text` is composed from those; `street`/`district`
 * carry the parts so a read round-trips back to line1/city. `name` is dropped (no
 * backend field). A point with no words sends no text at all, and the server describes
 * it itself. Accepted keys only: full_text, label, region_code, district, street, lat,
 * lng, is_default.
 */
function toAddressBody(input: AddressInput): Record<string, unknown> {
  const line1 = input.line1.trim();
  const city = input.city.trim();
  const fullText = [line1, city].filter(Boolean).join(', ');
  const label = input.label.trim() || line1;
  const body: Record<string, unknown> = {};
  if (fullText) body.full_text = fullText;
  if (label) body.label = label;
  if (line1) body.street = line1;
  if (city) body.district = city;
  if (input.landmark !== undefined) body.landmark = input.landmark.trim() || null;
  if (input.lat !== undefined && input.lng !== undefined) {
    body.lat = input.lat;
    body.lng = input.lng;
  }
  debugLog('address', '→ wire body (mapped to backend DTO)', body);
  return body;
}

/** A point saved with no words is stored under its own coordinates, for the operator and
 *  the courier. That is not a street to show the buyer. */
const COORDINATES_TEXT = /^-?\d+(\.\d+)?, -?\d+(\.\d+)?$/;

/** Map a backend `RawAddress` back onto the app's `Address`. */
function mapRawAddress(raw: RawAddress): Address {
  const written = raw.full_text && !COORDINATES_TEXT.test(raw.full_text) ? raw.full_text : null;
  return {
    id: raw.id,
    label: raw.label ?? raw.street ?? written ?? 'Address',
    line1: raw.street ?? written ?? '',
    city: raw.district ?? raw.region_code ?? '',
    landmark: raw.landmark ?? null,
    isDefault: raw.is_default ?? false,
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
  };
}

type RawAddressSuggestion = {
  id?: string | number | null;
  title?: string | null;
  subtitle?: string | null;
  city?: string | null;
  district?: string | null;
  street?: string | null;
  house_number?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/** One suggestion, or nothing when it has no real point to save: picking it could not
 *  be priced, so it must not be offered. */
function mapRawSuggestion(raw: RawAddressSuggestion): AddressSuggestion[] {
  if (
    !raw.title ||
    typeof raw.lat !== 'number' ||
    !Number.isFinite(raw.lat) ||
    typeof raw.lng !== 'number' ||
    !Number.isFinite(raw.lng)
  ) {
    return [];
  }
  return [
    {
      id: String(raw.id ?? `${raw.lat},${raw.lng}`),
      title: raw.title,
      subtitle: raw.subtitle ?? null,
      city: raw.city ?? null,
      district: raw.district ?? null,
      street: raw.street ?? null,
      houseNumber: raw.house_number ?? null,
      lat: raw.lat,
      lng: raw.lng,
    },
  ];
}

/**
 * Normalize a collection response to a plain array. The backend wraps
 * collections in a `{ items: [...] }` envelope (confirmed on `GET /v1/categories`),
 * but older/other endpoints may return a bare array — accept either. Anything
 * unexpected (an error object slipped through with a 200, a null, a string)
 * degrades to `[]` so the screen renders its empty state instead of crashing
 * with "undefined is not a function" when it calls `.map` / `.find` / `.filter`.
 */
export function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    for (const key of ['items', 'data', 'results']) {
      const v = (raw as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

/**
 * Raw order object as returned by api.mator.uz (verified live 2026-07-21).
 * `GET /v1/orders` (list, `{ items, next_cursor }`), `GET /v1/orders/:id`
 * (detail), and `POST /v1/orders` (create) all return THIS same shape. Prices
 * are UZS integers; there is no per-step timeline, courier, or embedded address
 * — the app derives its richer `OrderDetail`/`OrderListRow` from these fields.
 */
export type RawBackendOrder = {
  order_id: string;
  /** Payment-oriented lifecycle: pending_payment | paid | packed | shipped |
   *  out_for_delivery | delivered | cancelled | expired | refunded | … */
  status: string;
  subtotal_uzs?: number;
  delivery_uzs?: number;
  service_fee_uzs?: number;
  discount_uzs?: number;
  total_uzs?: number;
  currency?: string;
  vehicle_id?: string | null;
  delivery_address_id?: string | null;
  delivery_method?: string | null;
  payment_type?: string | null;
  items?: Array<{
    part_id?: string | null;
    service_id?: string | null;
    title?: string;
    qty?: number;
    price_uzs?: number;
    line_total_uzs?: number;
    scheduled_at?: string | null;
  }>;
  expires_at?: string;
  created_at?: string;
  updated_at?: string;
};

/** "280000" → "280 000 сум" / "280 000 soʻm" / "280 000 UZS", in the app's language. */
function formatUzs(n: number | undefined): string {
  return formatCurrency(n ?? 0);
}

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Each part of what the order charges, as stored. Null unless the backend stated them all. */
export function mapOrderCharges(o: RawBackendOrder): OrderCharges | null {
  if (!isAmount(o.subtotal_uzs) || !isAmount(o.total_uzs)) return null;
  return {
    subtotal: o.subtotal_uzs,
    discount: isAmount(o.discount_uzs) ? o.discount_uzs : 0,
    serviceFee: isAmount(o.service_fee_uzs) ? o.service_fee_uzs : 0,
    delivery: isAmount(o.delivery_uzs) ? o.delivery_uzs : 0,
    total: o.total_uzs,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO → "Jul 21, 2026". Empty string on missing/invalid input. */
function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Backend status → the order-history pill. Unknown/early states read as
 *  "Processing" so a new backend status never breaks the list. Operator
 *  transitions (`confirmed`, `out_for_delivery`, `delivered`) are all covered
 *  so an admin status change is reflected the moment the app re-fetches. */
function mapListStatus(s: string): OrderListStatus {
  switch (s) {
    case 'delivered':
    case 'refunded':
      return 'Delivered';
    case 'shipped':
    case 'out_for_delivery':
      return 'Out for delivery';
    case 'processing':
    case 'in_transit':
      return 'In Transit';
    case 'cancelled':
    case 'expired':
      return 'Cancelled';
    default:
      return 'Processing'; // pending_payment, paid
  }
}

/** Backend status → the detail step-machine key. Covers the full backend
 *  lifecycle so an operator advance (via `PATCH /v1/orders/:id/status`) always
 *  maps to a concrete timeline step — `confirmed`/`paid` sit at "Packed" (order
 *  accepted, being prepared), `pending_confirmation` stays at "Order placed". */
function mapDetailStatus(s: string): OrderStatus {
  // Backend forward path pending_payment→paid→processing→shipped→delivered is
  // mapped monotonically onto the app's 5-step timeline
  // placed→packed→shipped→out_for_delivery→delivered.
  switch (s) {
    case 'delivered':
    case 'refunded':
      return 'delivered';
    case 'shipped':
      return 'out_for_delivery';
    case 'processing':
    case 'in_transit':
      return 'shipped';
    case 'paid':
    case 'packed':
      return 'packed';
    case 'cancelled':
    case 'expired':
      return 'cancelled';
    default:
      return 'placed'; // pending_payment
  }
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Payment received',
  processing: 'Processing',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired',
  refunded: 'Refunded',
};

const STEP_DEFS: { key: OrderStatus; label: string }[] = [
  { key: 'placed', label: 'Order placed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

function totalItemCount(o: RawBackendOrder): number {
  return (o.items ?? []).reduce((n, i) => n + (i.qty ?? 0), 0);
}

function orderSummary(o: RawBackendOrder): string {
  const items = o.items ?? [];
  const first = items[0]?.title?.trim() || 'Order';
  const rest = items.length - 1;
  return rest > 0 ? `${first} + ${rest} item${rest > 1 ? 's' : ''}` : first;
}

/** Raw backend order → order-history row. */
export function mapOrderToListRow(o: RawBackendOrder): OrderListRow {
  return {
    id: o.order_id,
    date: formatDate(o.created_at),
    status: mapListStatus(o.status),
    items: totalItemCount(o),
    total: formatUzs(o.total_uzs),
    summary: orderSummary(o),
  };
}

function asPaymentType(value: string | null | undefined): PaymentType | null {
  return value === 'payme' || value === 'terminal' || value === 'cash' ? value : null;
}

/** Raw backend order → the richer detail shape the track screen renders. The
 *  backend has no per-step timeline / courier / embedded address, so the step
 *  captions beyond "placed" are blank and courier is null. */
export function mapOrderToDetail(o: RawBackendOrder): OrderDetail {
  const status = mapDetailStatus(o.status);
  const placedAt = formatDate(o.created_at);
  const activeIndex = STEP_DEFS.findIndex((s) => s.key === status);
  return {
    id: o.order_id,
    status,
    statusLabel: STATUS_LABEL[o.status] ?? 'Processing',
    // ETA headline. The backend gives no delivery window, so this is only a
    // meaningful value for terminal states; otherwise '' and the tracking card
    // falls back to the status label (avoids a redundant "Awaiting payment"
    // shown twice).
    etaWindow: status === 'delivered' ? 'Delivered' : '',
    placedAt,
    steps: STEP_DEFS.map((s, i) => ({ key: s.key, label: s.label, caption: i === 0 ? placedAt : '' })),
    currentStepIndex: status === 'cancelled' ? 0 : Math.max(0, activeIndex),
    destination: {
      id: o.delivery_address_id ?? '',
      label: o.delivery_method === 'courier' ? 'Courier delivery' : 'Delivery',
      line1: '',
      city: '',
    },
    courier: null,
    items: (o.items ?? []).map((it, i) => ({
      id: it.part_id ?? it.service_id ?? `item_${i}`,
      title: it.title ?? 'Item',
      quantity: it.qty ?? 1,
      price: formatUzs(it.price_uzs),
    })),
    totalLabel: formatUzs(o.total_uzs),
    charges: mapOrderCharges(o),
    serverStatus: o.status,
    paymentType: asPaymentType(o.payment_type),
  };
}

export class HttpOrdersTransport implements OrdersTransport {
  async listOrders(req: OrderListRequest, signal?: AbortSignal): Promise<OrderListPage> {
    // Backend is cursor-paginated (`{ items, next_cursor }`) and REJECTS
    // page/pageSize/status query params with a 400 ("property page should not
    // exist" — verified live). So we fetch the first page unfiltered and map the
    // raw orders to history rows; status filtering (if any) happens client-side.
    const raw = await apiClient.get<unknown>('/v1/orders', { signal });
    const rawItems = asList<RawBackendOrder>(raw);
    let items = rawItems.map(mapOrderToListRow);
    if (req.status) items = items.filter((o) => o.status === req.status);
    return { items, total: items.length, page: 1, pageSize: items.length };
  }

  async getOrder(orderId: string, signal?: AbortSignal): Promise<OrderDetail | null> {
    try {
      const raw = await apiClient.get<RawBackendOrder>(
        `/v1/orders/${encodeURIComponent(orderId)}`,
        { signal },
      );
      return mapOrderToDetail(raw);
    } catch (e) {
      // 404 → the order doesn't exist; surface as null so the screen shows its
      // not-found state instead of an error toast.
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  async createOrder(input: CreateOrderInput, signal?: AbortSignal): Promise<CreateOrderResult> {
    // The backend builds the order from the SERVER-side cart (POST /v1/cart/items),
    // NOT from a body item list — so we send only the checkout selections. It
    // returns a `pending_payment` order; payment (Payme/Click invoice + deep link)
    // is a separate follow-up flow. Unknown props 400 the request, so we send
    // exactly the whitelisted fields.
    const body: Record<string, unknown> = {
      cart_snapshot: {
        delivery_method: input.shippingOptionKey === 'pickup' ? 'pickup' : 'courier',
        delivery_address_id: input.addressId ?? null,
        promo_code: input.promoCode ?? null,
      },
    };
    if (input.vehicleId) body.vehicle_id = input.vehicleId;
    if (input.contactPhone) body.contact_phone_e164 = toE164(input.contactPhone);
    // Chosen payment method (payme = online, terminal = card reader on delivery,
    // cash = cash on delivery). The backend persists it so it can route the
    // Payme/Click webhook and report by method.
    if (input.paymentType) body.payment_type = input.paymentType;
    // The courier price the buyer was shown. The server compares, and never charges from it.
    if (typeof input.confirmedDeliveryUzs === 'number') {
      body.confirmed_delivery_uzs = input.confirmedDeliveryUzs;
    }
    if (input.deliveryQuoteId) body.delivery_quote_id = input.deliveryQuoteId;
    // The total the buyer was shown, fee included. Compared, never charged from.
    if (typeof input.confirmedTotalUzs === 'number') {
      body.confirmed_total_uzs = input.confirmedTotalUzs;
    }

    const r = await apiClient.post<RawBackendOrder>('/v1/orders', body, { signal });
    return {
      orderId: r.order_id,
      eta: r.status === 'pending_payment' ? 'Awaiting payment' : formatDate(r.created_at),
      totalLabel: formatUzs(r.total_uzs),
    };
  }

  async listAddresses(signal?: AbortSignal): Promise<Address[]> {
    const raw = asList<RawAddress>(await apiClient.get<unknown>('/v1/account/addresses', { signal }));
    return raw.map(mapRawAddress);
  }

  async searchAddresses(
    query: AddressSearchQuery,
    signal?: AbortSignal,
  ): Promise<AddressSuggestions> {
    // What was typed and where the map is looking, which is all a search needs.
    const params = Object.entries({
      street: query.street,
      house: query.house,
      city: query.city,
      lang: query.lang,
      ...(query.mode === 'search' ? { mode: 'search' } : {}),
      ...(query.nearLat !== undefined && query.nearLng !== undefined
        ? { near_lat: String(query.nearLat), near_lng: String(query.nearLng) }
        : {}),
    })
      .filter((entry): entry is [string, string] => !!entry[1])
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    const raw = await apiClient.get<{ items?: unknown; attribution?: string | null }>(
      `/v1/addresses/suggestions?${params}`,
      { signal },
    );
    return {
      items: asList<RawAddressSuggestion>(raw?.items).flatMap(mapRawSuggestion),
      attribution: raw?.attribution ?? null,
    };
  }

  async describePoint(
    point: DeliveryPoint,
    lang: string,
    signal?: AbortSignal,
  ): Promise<PointDescription> {
    const raw = await apiClient.get<{
      address?: {
        city?: string | null;
        district?: string | null;
        street?: string | null;
        house_number?: string | null;
      } | null;
      within_coverage?: boolean | null;
      attribution?: string | null;
    }>(`/v1/addresses/reverse?lat=${point.lat}&lng=${point.lng}&lang=${encodeURIComponent(lang)}`, {
      signal,
    });
    return {
      address: raw?.address
        ? {
            city: raw.address.city ?? null,
            district: raw.address.district ?? null,
            street: raw.address.street ?? null,
            houseNumber: raw.address.house_number ?? null,
          }
        : null,
      withinCoverage: raw?.within_coverage ?? null,
      attribution: raw?.attribution ?? null,
    };
  }

  async getDeliveryCoverage(signal?: AbortSignal): Promise<DeliveryCoverageInfo> {
    const raw = await apiClient.get<{
      configured?: boolean;
      bounds?: { min_lat: number; min_lng: number; max_lat: number; max_lng: number } | null;
      geometry?: unknown;
    }>('/v1/shipping/coverage', { signal });
    return {
      configured: raw?.configured === true,
      bounds: raw?.bounds
        ? {
            minLat: raw.bounds.min_lat,
            minLng: raw.bounds.min_lng,
            maxLat: raw.bounds.max_lat,
            maxLng: raw.bounds.max_lng,
          }
        : null,
      polygons: parseCoverageGeometry(raw?.geometry),
    };
  }

  async createAddress(input: AddressInput): Promise<Address> {
    const raw = await apiClient.post<RawAddress>('/v1/addresses', toAddressBody(input));
    return mapRawAddress(raw);
  }

  async updateAddress(id: string, input: AddressInput): Promise<Address> {
    const raw = await apiClient.patch<RawAddress>(
      `/v1/addresses/${encodeURIComponent(id)}`,
      toAddressBody(input),
    );
    return mapRawAddress(raw);
  }

  removeAddress(id: string): Promise<void> {
    return apiClient.delete<void>(`/v1/addresses/${encodeURIComponent(id)}`);
  }

  setDefaultAddress(id: string): Promise<void> {
    return apiClient.post<void>(`/v1/addresses/${encodeURIComponent(id)}/default`);
  }

  async listPaymentMethods(signal?: AbortSignal): Promise<PaymentMethod[]> {
    return asList<PaymentMethod>(
      await apiClient.get<unknown>('/v1/account/payment-methods', { signal }),
    );
  }

  createPaymentMethod(input: PaymentMethodInput): Promise<PaymentMethod> {
    return apiClient.post<PaymentMethod>('/v1/payment-methods', input);
  }

  updatePaymentMethod(id: string, input: PaymentMethodInput): Promise<PaymentMethod> {
    return apiClient.patch<PaymentMethod>(
      `/v1/payment-methods/${encodeURIComponent(id)}`,
      input,
    );
  }

  removePaymentMethod(id: string): Promise<void> {
    return apiClient.delete<void>(`/v1/payment-methods/${encodeURIComponent(id)}`);
  }

  setDefaultPaymentMethod(id: string): Promise<void> {
    return apiClient.post<void>(`/v1/payment-methods/${encodeURIComponent(id)}/default`);
  }

  async getShippingQuote(
    req: ShippingQuoteRequest,
    signal?: AbortSignal,
  ): Promise<ShippingOption[]> {
    const raw = await apiClient.post<{
      options?: {
        type?: string;
        label?: string;
        price_uzs?: number;
        quote_id?: string | null;
      }[];
    }>(
      '/v1/shipping/quote',
      { delivery_address_id: req.addressId, delivery_method: 'courier' },
      { signal },
    );
    // An option with no real price is dropped rather than read as free, so the checkout
    // treats it as no quote at all. So is a price with no quote behind it: the order would
    // only be refused. Zero has none, because there is nothing to deliver.
    return (raw?.options ?? []).flatMap((o) => {
      const price = o.price_uzs;
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return [];
      const quoteId = o.quote_id || null;
      if (price > 0 && !quoteId) return [];
      return [{ key: o.type ?? 'courier', label: o.label ?? '', price, quoteId }];
    });
  }
}

// ── Singleton ────────────────────────────────────────────────────────

/** Flips automatically based on `EXPO_PUBLIC_API_BASE_URL`. */
export const ordersTransport: OrdersTransport = shouldUseHttpTransport('orders')
  ? new HttpOrdersTransport()
  : new MockOrdersTransport();
