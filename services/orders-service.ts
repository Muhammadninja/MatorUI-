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
  /** Display-formatted price string ("$1,240"). Server-issued. */
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

export type ShippingOption = {
  /** Stable server key (`standard`, `express`, `same_day`, etc.). */
  key: string;
  label: string;
  /** Server-formatted ETA string ("3–5 business days"). */
  eta: string;
  /** Numeric fee in dollars. 0 = free. */
  price: number;
};

/** Input from the client when creating an order. The server owns all
 *  pricing math from here — we send selections, not totals. */
export type CreateOrderInput = {
  /** Line items as known to the cart at submit time. The server
   *  re-validates pricing and rejects on mismatch. */
  items: { productId: string; quantity: number }[];
  addressId: string;
  paymentMethodId: string;
  shippingOptionKey: string;
  /** Optional promo code already applied to the cart. */
  promoCode: string | null;
  /** Optional courier note. */
  note?: string;
};

export type CreateOrderResult = {
  orderId: string;
  /** ETA window string suitable for the confirmation screen. */
  eta: string;
  /** Pre-formatted grand total for the receipt. */
  totalLabel: string;
};
