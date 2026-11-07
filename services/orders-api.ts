/** Live HTTP transport and public contracts. Test doubles live under tests/support. */
import i18next from 'i18next';
import { confirmedMoney, formatOrderMoney, getOrderPricing } from '@/services/order-pricing';
import type {
  Address,
  AddressInput,
  AddressSearchQuery,
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
  PickupPoint,
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
  /** Where the cart's goods are collected: one entry per dealer the cart buys from. */
  getPickupPoints(signal?: AbortSignal): Promise<PickupPoint[]>;
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
 *   POST   /v1/shipping/quote                      → { options: [{ type, label, available,
 *          price_uzs, quote_id, unavailable_reason }], currency }  — NOT a bare array, and the
 *          request body is `{ delivery_address_id, delivery_method: 'courier' }` (snake_case).
 *          Pickup and the courier both come back; a courier that cannot be had is
 *          `available: false` with `unavailable_reason.code`, which the checkout words itself
 *          (checkout-presentation.ts), as it does the `code` of a refused request.
 *   GET    /v1/shipping/pickup-points              → { pickup_points: [{ dealer_id, dealer_name,
 *          address, landmark, location: { lat, lng } | null, items: [{ cart_item_id, part_id,
 *          title, quantity }] }] }: each dealer the cart buys from, once, with its own lines.
 *          A null address or location means the dealer has none on record yet.
 */
import { apiClient, ApiError } from '@/services/api-client';
import { asList, HttpOrdersAccountTransport } from '@/services/orders-account-api';
export { asList } from '@/services/orders-account-api';

/** Strip spaces / dashes / parens so "+998 90 123 45 67" → "+998901234567". */
function toE164(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
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
  subtotal_uzs?: number | null;
  delivery_uzs?: number | null;
  service_fee_uzs?: number | null;
  discount_uzs?: number | null;
  total_uzs?: number | null;
  currency?: string;
  vehicle_id?: string | null;
  delivery_address_id?: string | null;
  delivery_method?: string | null;
  payment_type?: string | null;
  items?: Array<{
    part_id?: string | null;
    service_id?: string | null;
    title?: string;
    qty?: number | null;
    price_uzs?: number | null;
    line_total_uzs?: number | null;
    scheduled_at?: string | null;
  }>;
  expires_at?: string;
  created_at?: string;
  updated_at?: string;
};

/** "280000" → "280 000 so'm". Manual thousands grouping (no reliance on Intl,
 *  which is patchy under Hermes). */
function formatUzs(n: number | null | undefined, currency?: string | null): string {
  return currency == null || currency === 'UZS' ? formatOrderMoney(n) : '';
}

const isAmount = (value: unknown): value is number =>
  confirmedMoney(value) !== null;

/** Each part of what the order charges, as stored. Null unless the backend stated them all. */
export function mapOrderCharges(o: RawBackendOrder): OrderCharges | null {
  if (o.currency != null && o.currency !== 'UZS') return null;
  if (!isAmount(o.subtotal_uzs) || !isAmount(o.total_uzs)) return null;
  return {
    subtotal: o.subtotal_uzs,
    discount: isAmount(o.discount_uzs) ? o.discount_uzs : 0,
    serviceFee: isAmount(o.service_fee_uzs) ? o.service_fee_uzs : 0,
    delivery: isAmount(o.delivery_uzs) ? o.delivery_uzs : 0,
    total: o.total_uzs,
  };
}

const DATE_LOCALES: Record<string, string> = { en: 'en-US', ru: 'ru-RU', uz: 'uz-UZ' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO → a date in the active language ("Jul 21, 2026" before i18n starts). Empty string on missing/invalid input. */
function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const locale = i18next.isInitialized ? DATE_LOCALES[i18next.language] : undefined;
  if (locale) {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  }
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
    total: formatUzs(o.total_uzs, o.currency),
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
  const pricing = getOrderPricing(o);
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
      quantity: pricing.lines[i].quantity ?? 0,
      price: formatUzs(pricing.lines[i].unitPrice),
    })),
    totalLabel: formatUzs(pricing.total),
    pricing,
    charges: mapOrderCharges(o),
    serverStatus: o.status,
    paymentType: asPaymentType(o.payment_type),
  };
}

export class HttpOrdersTransport extends HttpOrdersAccountTransport implements OrdersTransport {
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
      totalLabel: formatUzs(r.total_uzs, r.currency),
    };
  }


}

// ── Singleton ────────────────────────────────────────────────────────

/** Flips automatically based on `EXPO_PUBLIC_API_BASE_URL`. */
export const ordersTransport: OrdersTransport = new HttpOrdersTransport();
