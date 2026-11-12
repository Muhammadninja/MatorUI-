import type { OrderPricing } from '@/services/order-pricing';

/**
 * Orders domain — types only. Pure module so it can be imported from
 * service, transport, hooks, screens, and tests without dragging a
 * React or React Native dep along.
 *
 * Mirrors the catalog / garage / cart split: types live here, transport
 * lives in orders-api.ts, React glue lives in hooks/use-orders.ts.
 *
 * The shapes are server-shaped (not screen-shaped) — every field on
 * `OrderDetail` is something a real backend would return. The screens
 * read what they need; nothing is reshaped at the edge of the network.
 */

import type { DeliveryPolygons } from '@/services/delivery-coverage';

/** Step the order is currently at. Server is the source of truth — the
 *  client renders a fixed STEPS array and lights up steps `<= status`. */
export type OrderStatus =
  | 'placed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

/** Top-line status string the order-history row renders as a colored
 *  pill. Derived from `OrderStatus` but kept loose so the server can
 *  add new labels without breaking the client. */
export type OrderListStatus =
  | 'Processing'
  | 'In Transit'
  | 'Out for delivery'
  | 'Delivered'
  | 'Cancelled';

/**
 * i18n key maps for status labels. The stable machine values (`OrderStatus`)
 * and the loose display union (`OrderListStatus`) are the source of truth; the
 * UI resolves these keys to localized copy via `t(key, { defaultValue })`, so a
 * label the server sends that isn't in the map still renders (untranslated)
 * rather than blank. Kept in this pure module so screens and tests share it.
 */
export const ORDER_LIST_STATUS_I18N: Record<OrderListStatus, string> = {
  Processing: 'orderStatus.list.processing',
  'In Transit': 'orderStatus.list.inTransit',
  'Out for delivery': 'orderStatus.list.outForDelivery',
  Delivered: 'orderStatus.list.delivered',
  Cancelled: 'orderStatus.list.cancelled',
};

export const ORDER_STEP_I18N: Record<OrderStatus, string> = {
  placed: 'orderStatus.step.placed',
  packed: 'orderStatus.step.packed',
  shipped: 'orderStatus.step.shipped',
  out_for_delivery: 'orderStatus.step.outForDelivery',
  delivered: 'orderStatus.step.delivered',
  cancelled: 'orderStatus.step.cancelled',
};

/**
 * The transport layer emits English display strings for the richer *raw*
 * backend statuses (e.g. `statusLabel`/`etaWindow` = "Awaiting payment",
 * "On the way", "Delivered"). This maps those exact strings to i18n keys so
 * a screen can localize a status word while passing real ETA/date strings
 * (which aren't in the map) through unchanged. Keyed by the English label.
 */
export const ORDER_STATUS_LABEL_I18N: Record<string, string> = {
  'Awaiting payment': 'orderStatus.raw.pendingPayment',
  'Payment received': 'orderStatus.raw.paid',
  Processing: 'orderStatus.raw.processing',
  'On the way': 'orderStatus.raw.shipped',
  Delivered: 'orderStatus.raw.delivered',
  Cancelled: 'orderStatus.raw.cancelled',
  Expired: 'orderStatus.raw.expired',
  Refunded: 'orderStatus.raw.refunded',
};

/**
 * Backend `OrderStatus` enum, lowercased exactly as it arrives in a
 * notification's `data.status` (e.g. `order_status_changed` emits
 * `to.toLowerCase()`), → i18n key. Lets the notification feed show a localized
 * status word instead of the raw English the backend embeds in its copy.
 */
export const ORDER_STATUS_MACHINE_I18N: Record<string, string> = {
  pending_payment: 'orderStatus.raw.pendingPayment',
  paid: 'orderStatus.raw.paid',
  processing: 'orderStatus.raw.processing',
  shipped: 'orderStatus.raw.shipped',
  delivered: 'orderStatus.raw.delivered',
  cancelled: 'orderStatus.raw.cancelled',
  refunded: 'orderStatus.raw.refunded',
  expired: 'orderStatus.raw.expired',
};

export type OrderStep = {
  key: OrderStatus;
  label: string;
  /** Server-issued timestamp string, already pre-formatted for display
   *  ("Tue · 9:42 AM"). Keeping it as a string lets the server own the
   *  locale/timezone, which the client can't reliably know. */
  caption: string;
};

export type OrderItem = {
  id: string;
  title: string;
  quantity: number;
  /** Formatted server unit price; confirmed row totals live in OrderDetail.pricing. */
  price: string;
  /** Optional product image URL. */
  imageUrl?: string;
};

export type Address = {
  id: string;
  label: string;
  line1: string;
  /** "Brooklyn, NY 11211" — server-formatted to avoid client locale work. */
  city: string;
  /** Recipient full name for the shipping label. Added for the account
   *  shipping-addresses form, which collects a name; optional so existing
   *  order/detail seeds that don't set it stay valid. */
  name?: string;
  /** True for the user's default shipping address. Optional for the same
   *  back-compat reason — the server enforces a single default. */
  isDefault?: boolean;
  /** A readable hint for the courier. A map pin may have no other words at all. */
  landmark?: string | null;
  /** Where the address is on the ground, which courier delivery is priced from and the
   *  courier goes to. Set only when the buyer chooses one. Null or absent means not chosen. */
  lat?: number | null;
  lng?: number | null;
};

export type Courier = {
  name: string;
  company: string;
  /** "Ford Transit · 8KJ-2491" — server-formatted. */
  vehicle: string;
  rating: number;
  /** Optional contact endpoints — if absent the call/message buttons hide. */
  phone?: string;
  chatThreadId?: string;
  avatarUrl?: string;
};

export type OrderListRow = {
  id: string;
  /** Server-formatted date ("May 28, 2026"). */
  date: string;
  status: OrderListStatus;
  /** Total item count across all line items. */
  items: number;
  /** Display-formatted total ("$486.00"). */
  total: string;
  /** Short headline of the order ("Garrett GTX3582R + 2 items"). */
  summary: string;
  /** Backend's own status word, for the cancel window. Absent from older sources. */
  serverStatus?: string;
  /** ISO creation time, as the server sent it. */
  createdAt?: string;
  /** ISO time the server will expire an unpaid order, when it says. */
  expiresAt?: string;
};

export type OrderListPage = {
  items: OrderListRow[];
  /** Total rows across all pages. The client uses this for paging UI
   *  and for the "5 orders placed in the last 12 months" header. */
  total: number;
  /** Page index returned (1-based). Mirrors the request. */
  page: number;
  pageSize: number;
};

/**
 * What an order charges, each part apart, exactly as the backend stored it when the order was
 * placed. Fixed from then on: nothing here is worked out by the app.
 */
export type OrderCharges = {
  /** The cost of the parts. */
  subtotal: number;
  discount: number;
  /** Mator's service fee. 0 when the order carries none. */
  serviceFee: number;
  delivery: number;
  /** What the buyer pays: the parts after discount, the fee and delivery. */
  total: number;
};

export type OrderDetail = {
  id: string;
  status: OrderStatus;
  /** Friendly status string for the chip ("Out for delivery"). */
  statusLabel: string;
  /** Server-formatted ("14:30 – 15:00" or "Wed, Jun 5"). */
  etaWindow: string;
  placedAt: string;
  steps: OrderStep[];
  /** Index into `steps` of the current step. Derived server-side so
   *  the client doesn't have to map status → index. */
  currentStepIndex: number;
  destination: Address;
  courier: Courier | null;
  items: OrderItem[];
  /** Display-formatted grand total ("$2,170.00"). */
  totalLabel: string;
  /** Source amounts and validation; missing values remain unknown. */
  pricing?: OrderPricing;
  /** Each part of the total, as stored on the order. Absent when the source states none. */
  charges?: OrderCharges | null;
  /** The backend's own word for the status (`pending_payment`, `paid`, …), before it is
   *  mapped onto the timeline, which calls an unpaid order 'placed'. Anything deciding
   *  about payment reads this. */
  serverStatus?: string;
  /** How the order is being paid, when the backend says. Cash and terminal orders wait in
   *  `pending_payment` too, for an operator, so the status alone cannot tell. */
  paymentType?: PaymentType | null;
  /** ISO creation time, as the server sent it. Starts the 20-minute cancel window. */
  createdAt?: string;
  /** ISO time the server will expire an unpaid order, when it says. */
  expiresAt?: string;
};

export type PaymentMethod = {
  id: string;
  /** Card brand ("Mastercard", "Visa", "Amex"). */
  brand: string;
  /** Last 4 digits, server-issued. Never PAN. */
  last4: string;
  /** Expiry "MM/YY". */
  exp: string;
  isDefault: boolean;
};

/** Supported payment methods for the Uzbek market. Selected at checkout —
 *  no stored card/PAN. Payme is online; Terminal is a card reader the courier
 *  brings; Cash is cash-on-delivery. */
export type PaymentType = 'payme' | 'terminal' | 'cash';

/** One way to get the order, as the backend's quote states it: priced, or not available. */
export type ShippingOption = AvailableShippingOption | UnavailableShippingOption;

export type AvailableShippingOption = {
  /** Stable server key (`pickup`, `courier`). */
  key: string;
  label: string;
  /** Absent on a backend that only ever listed options it could price. */
  available?: true;
  /** Numeric fee in UZS. 0 = free (pickup). */
  price: number;
  /** Names what a courier price is for: the saved destination, the pickup points and the
   *  rates. Handed back when placing the order, which the server refuses if any changed. */
  quoteId?: string | null;
};

/** The backend offers this way but cannot deliver it now: it says why, and gives no price. */
export type UnavailableShippingOption = {
  key: string;
  label: string;
  available: false;
  /** Never a number: an option that cannot be had is not a free one. */
  price: null;
  quoteId?: null;
  /** The backend's code for why (`DELIVERY_OUTSIDE_COVERAGE`, …), worded by the checkout.
   *  Null when it gave none. */
  unavailableCode: string | null;
};

/** Where the buyer collects one dealer's goods, as the backend states it for the cart: the
 *  dealer each part is bought from, never a list of every dealer. */
export type PickupPoint = {
  /** The storefront the goods are bought from. Null for goods whose dealer is not known. */
  dealerId: string | null;
  dealerName: string | null;
  /** Null while the dealer has given no address. */
  address: string | null;
  landmark: string | null;
  /** Null while the dealer has no location on record. Never a made-up point. */
  location: DeliveryPoint | null;
  /** This dealer's lines in the cart, and only those. */
  items: { cartItemId: string; partId: string | null; title: string; quantity: number }[];
};

/** Input from the client when creating an order. The server owns all
 *  pricing math from here — we send selections, not totals. */
export type CreateOrderInput = {
  /** Line items as known to the cart at submit time. The server
   *  re-validates pricing and rejects on mismatch. */
  items: { productId: string; quantity: number }[];
  /** Selected delivery address, or `null` when the buyer skips it and collects
   *  the order themselves. */
  addressId: string | null;
  /** Chosen payment method (Payme / Terminal / Cash). */
  paymentType: PaymentType;
  shippingOptionKey: string;
  /** Optional promo code already applied to the cart. */
  promoCode: string | null;
  /** The courier price the buyer was shown. The server computes its own and refuses
   *  the order if the two differ, so this only says what the buyer agreed to. */
  confirmedDeliveryUzs?: number | null;
  /** The quote that price came from. See `ShippingOption.quoteId`. */
  deliveryQuoteId?: string | null;
  /** The total the buyer was shown, fee and delivery included. The server works out its own
   *  and refuses the order (`ORDER_TOTAL_CHANGED`) if the two differ: it never charges this. */
  confirmedTotalUzs?: number | null;
  /** Optional courier note. */
  note?: string;
  /** Garage vehicle this order is for (backend `vehicle_id`). Optional — the
   *  backend accepts a null vehicle. */
  vehicleId?: string;
  /** Contact number for the courier (backend `contact_phone_e164`). Optional;
   *  normalized to E.164 by the transport. Sourced from the signed-in profile. */
  contactPhone?: string;
  /** Optimistic display hint: the grand total the client already
   *  rendered on the checkout button. A real backend recomputes pricing
   *  authoritatively and MAY ignore this; the mock echoes it so the
   *  just-placed order's confirmation/track total isn't blank. */
  totalLabel?: string;
  /** Sent as `Idempotency-Key`. The same key is reused when the buyer retries
   *  the same order after a failure, so a request whose response was lost
   *  can't create a second order on a backend that honors the header. */
  idempotencyKey?: string;
};

/**
 * Short, display-friendly order number derived from the backend id. Backend
 * order ids are long ULIDs ("ord_01KY2DNPSRYPT8C7SDT2N7JJCH", 30 chars) that
 * overflow the compact receipt/tracking UI, so we show a "#" + last 6 alnum
 * chars ("#N7JJCH"). Already-short mock ids ("ORD-8821", "M-48291") are shown
 * as-is. The FULL id is still used for fetch/navigation — this is display only.
 */
export function formatOrderNo(id: string): string {
  if (!id) return '';
  if (id.length <= 10) return id;
  const tail = id.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase();
  return `#${tail}`;
}

export type CreateOrderResult = {
  orderId: string;
  /** ETA window string suitable for the confirmation screen. */
  eta: string;
  /** Pre-formatted grand total for the receipt. */
  totalLabel: string;
  /** Original checkout payload when this response resolves a stored attempt. */
  recoveredAttempt?: Omit<CreateOrderInput, 'totalLabel' | 'idempotencyKey'>;
};

// ── Address search ─────────────────────────────────────────────────────

/** What the buyer has typed so far, and only that. The backend does the searching. */
export type AddressSearchQuery = {
  street: string;
  house?: string;
  city?: string;
  lang: string;
  /** 'search' once the buyer submits what they typed, 'autocomplete' until then. */
  mode?: 'autocomplete' | 'search';
  /** Where the map is looking, to rank what is near it first. */
  nearLat?: number;
  nearLng?: number;
};

/** A place the backend offers for what was typed, which the buyer can pick and save. */
export type AddressSuggestion = {
  id: string;
  title: string;
  subtitle: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  /** Null when the match is a street or a place rather than a numbered building. */
  houseNumber: string | null;
  lat: number;
  lng: number;
};

export type AddressSuggestions = {
  items: AddressSuggestion[];
  /** Credit the data's licence requires wherever these are shown. */
  attribution: string | null;
};

/** A point on the map. Exactly what the buyer chose: never rounded on its way anywhere. */
export type DeliveryPoint = { lat: number; lng: number };

/** What the backend can say about a point the buyer has confirmed. Best effort throughout. */
export type PointDescription = {
  address: {
    city: string | null;
    district: string | null;
    street: string | null;
    houseNumber: string | null;
  } | null;
  /** Null when no delivery area is configured, so it cannot be said. */
  withinCoverage: boolean | null;
  attribution: string | null;
};

/** Whether couriers operate and where: the box to open the map on, and the very geometry the
 *  backend enforces, so a point outside it can be told on the map. Null when not known. */
export type DeliveryCoverageInfo = {
  configured: boolean;
  bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number } | null;
  polygons: DeliveryPolygons | null;
};

// ── Account CRUD inputs ────────────────────────────────────────────────

/** Client-supplied fields when creating/updating a shipping address. The
 *  server owns `id` and (via `setDefaultAddress`) the default flag. */
export type AddressInput = {
  label: string;
  name: string;
  line1: string;
  city: string;
  /** A readable hint for the courier. */
  landmark?: string;
  /** The point the buyer chose, on the map, from a suggestion or, if they ask, where they
   *  are now. Left out, the server keeps what it has unless the text moved the address, in
   *  which case it drops the old point. */
  lat?: number;
  lng?: number;
};

/** Client-supplied fields when creating/updating a payment method. Never
 *  the PAN — the card form only collects brand + last4 + expiry (a real
 *  integration would swap this for a tokenized handle from a PCI vault). */
export type PaymentMethodInput = {
  brand: string;
  last4: string;
  exp: string;
};
