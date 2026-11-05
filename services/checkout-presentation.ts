import type { Address, OrderDetail, ShippingOption } from '@/services/orders-service';

export type DeliveryMethod = 'courier' | 'pickup';

export type CheckoutDelivery = {
  method: DeliveryMethod;
  /** What delivery adds to the order, or null while no price is known. Null is never
   *  shown or sent as zero: a free courier is not something the checkout can state. */
  fee: number | null;
  /** Whether an order can be placed with this. */
  ready: boolean;
  /** The quote behind a courier price, which placing the order hands back. */
  quoteId: string | null;
};

/**
 * The checkout's one rule about delivery. A courier needs a price from the backend, so
 * while that is loading, refused or missing the order cannot be placed. Pickup costs
 * nothing, and with no address it is the only way to get the goods, but that has to be
 * the buyer's choice: an unanswered address prompt does not place a pickup order.
 */
export function resolveCheckoutDelivery(input: {
  hasAddress: boolean;
  addressSkipped: boolean;
  method: DeliveryMethod;
  quoteState: 'idle' | 'loading' | 'success' | 'error';
  options: ShippingOption[];
}): CheckoutDelivery {
  if (!input.hasAddress) {
    return input.addressSkipped
      ? { method: 'pickup', fee: 0, ready: true, quoteId: null }
      : { method: 'pickup', fee: null, ready: false, quoteId: null };
  }
  if (input.method === 'pickup') return { method: 'pickup', fee: 0, ready: true, quoteId: null };

  const courier =
    input.quoteState === 'success'
      ? input.options.find((option) => option.key === 'courier')
      : undefined;
  return courier
    ? { method: 'courier', fee: courier.price, ready: true, quoteId: courier.quoteId ?? null }
    : { method: 'courier', fee: null, ready: false, quoteId: null };
}

/** How the app words each delivery refusal: the server's own messages are English. */
const DELIVERY_ERROR_KEYS: Record<string, string> = {
  DELIVERY_ADDRESS_COORDINATES_MISSING: 'checkout.deliveryErrorNeedsLocation',
  PICKUP_LOCATION_MISSING: 'checkout.deliveryErrorSeller',
  DELIVERY_ROUTE_NOT_FOUND: 'checkout.deliveryErrorNoRoute',
  DELIVERY_ROUTING_UNAVAILABLE: 'checkout.deliveryErrorUnavailable',
  DELIVERY_ADDRESS_REQUIRED: 'checkout.deliveryErrorUnavailable',
  DELIVERY_COST_UNAVAILABLE: 'checkout.deliveryErrorUnavailable',
  DELIVERY_PRICE_CHANGED: 'checkout.deliveryPriceChanged',
  DELIVERY_QUOTE_STALE: 'checkout.deliveryQuoteStale',
  DELIVERY_OUTSIDE_COVERAGE: 'checkout.deliveryErrorOutsideCoverage',
  COURIER_DELIVERY_UNAVAILABLE: 'checkout.deliveryErrorCourierOff',
  DELIVERY_ADDRESS_COORDINATES_INVALID: 'checkout.deliveryErrorNeedsLocation',
};

/** The copy for a delivery refusal, or null when the code is about something else. */
export function deliveryRefusalKey(code: string | null): string | null {
  return (code && DELIVERY_ERROR_KEYS[code]) || null;
}

/** The copy for a quote that failed. Anything unrecognised reads as "try again". */
export function quoteErrorKey(code: string | null): string {
  return deliveryRefusalKey(code) ?? 'checkout.deliveryErrorUnavailable';
}

/**
 * What the buyer can do about a failed quote. Most of these are about the point the address
 * names, so they choose another; retrying helps only with a failure that may pass by itself,
 * and neither a seller with no pickup location nor couriers being off can be changed by the
 * buyer, who can still pick pickup.
 */
export function quoteErrorAction(code: string | null): 'edit_address' | 'retry' | null {
  if (
    code === 'DELIVERY_ADDRESS_COORDINATES_MISSING' ||
    code === 'DELIVERY_ADDRESS_COORDINATES_INVALID' ||
    code === 'DELIVERY_OUTSIDE_COVERAGE' ||
    code === 'DELIVERY_ROUTE_NOT_FOUND'
  ) {
    return 'edit_address';
  }
  if (code === 'PICKUP_LOCATION_MISSING' || code === 'COURIER_DELIVERY_UNAVAILABLE') return null;
  return 'retry';
}

// ── Addresses ──────────────────────────────────────────────────────────

/** The address as one line, for an address that may have no words at all. */
export function formatAddressLine(address: Pick<Address, 'line1' | 'city'>): string {
  return [address.line1, address.city].filter(Boolean).join(', ');
}

/** "Навои 12" → street and house, for the form's separate fields. Only ever split so that
 *  joining them gives the same text back, which is what tells an unedited address apart. */
export function splitLine1(line1: string): { street: string; house: string } {
  const match = /^(.*\S) (\d[^\s]{0,7})$/.exec(line1);
  return match ? { street: match[1]!, house: match[2]! } : { street: line1, house: '' };
}

export function composeLine1(street: string, house: string): string {
  return [street.trim(), house.trim()].filter(Boolean).join(' ');
}

/** How the app words a refused address. Anything else reads as "try again". */
export function addressSaveErrorKey(code: string | null): string {
  if (code === 'DELIVERY_OUTSIDE_COVERAGE') return 'account.addressOutsideCoverage';
  if (code === 'DELIVERY_ADDRESS_COORDINATES_INVALID') return 'account.addressInvalidLocation';
  return 'addresses.saveFailed';
}

// ── Payment ────────────────────────────────────────────────────────────

/** What the backend says about an order's payment. Only its status counts: a browser that
 *  came back, or a link that opened, proves nothing. An unknown status is not "paid". */
export type OrderPaymentState = 'settled' | 'closed' | 'awaiting' | 'unknown';

const SETTLED_STATUSES: ReadonlySet<string> = new Set(['paid', 'processing', 'shipped', 'delivered']);
const CLOSED_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'expired', 'refunded']);

export function orderPaymentState(status: string | null | undefined): OrderPaymentState {
  if (status === 'pending_payment') return 'awaiting';
  if (status && SETTLED_STATUSES.has(status)) return 'settled';
  if (status && CLOSED_STATUSES.has(status)) return 'closed';
  return 'unknown';
}

/** An order still waiting for the buyer to pay online. A cash or terminal order waits in the
 *  same status, for an operator, and has nothing to pay here. */
export function isAwaitingOnlinePayment(
  order: Pick<OrderDetail, 'serverStatus' | 'paymentType'>,
): boolean {
  return order.paymentType === 'payme' && orderPaymentState(order.serverStatus) === 'awaiting';
}

/** Why an order is still unpaid after trying. */
export type PaymentFailureReason =
  | 'fiscal' // the order's receipt data is not ready, so it cannot be charged online
  | 'parts' // something in the order can no longer be sold
  | 'start' // the payment could not be started: network, server, no link
  | 'cancelled' // the buyer left the payment page without paying
  | 'unconfirmed' // the buyer came back and the backend has not confirmed payment yet
  | 'unpaid'; // found unpaid on coming back to the checkout later

/** Why starting a payment was refused, from the server's code. */
export function paymentRefusalReason(code: string | null): PaymentFailureReason {
  if (code === 'FISCAL_DATA_INCOMPLETE') return 'fiscal';
  if (code === 'PART_UNAVAILABLE') return 'parts';
  return 'start';
}

const PAYMENT_FAILURE_KEYS: Record<PaymentFailureReason, string> = {
  fiscal: 'checkout.paymentErrorFiscal',
  parts: 'checkout.paymentErrorParts',
  start: 'checkout.paymentErrorStart',
  cancelled: 'checkout.paymentErrorCancelled',
  unconfirmed: 'checkout.paymentErrorUnconfirmed',
  unpaid: 'checkout.paymentErrorUnpaid',
};

export function paymentFailureKey(reason: PaymentFailureReason): string {
  return PAYMENT_FAILURE_KEYS[reason];
}

/** The heading over that: it failed, or it simply has not happened yet. */
export function paymentFailureTitleKey(reason: PaymentFailureReason): string {
  return reason === 'fiscal' || reason === 'parts' || reason === 'start'
    ? 'checkout.paymentFailedTitle'
    : 'checkout.paymentUnpaidTitle';
}
