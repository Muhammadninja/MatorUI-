/**
 * Which of the buyer's orders are shown where, and in what words. Pure: the "My orders"
 * screen, the order status card on Home and Profile, and tests share it.
 *
 *   • A cancelled or expired order is never listed: it did not happen.
 *   • "Active" is every order the backend can still move on, and a pickup order that has
 *     arrived and waits to be collected (for a few days after it arrived).
 *   • The status card shows the orders that need the buyer, or that they are waiting for:
 *     the active ones, and a courier order for a few days after it was delivered.
 *
 * Every status word is the backend's (`serverStatus`). An order from a source that states
 * none falls back to its list pill, so nothing is dropped for lack of it.
 */
import type { OrderListRow } from '@/services/orders-service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a courier order stays on the status card once delivered. */
export const DELIVERED_CARD_DAYS = 3;
/** How long a pickup order waiting at its pickup point stays active and on the card. */
export const PICKUP_CARD_DAYS = 7;

const CLOSED_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'expired']);
const DONE_STATUSES: ReadonlySet<string> = new Set(['delivered', 'refunded']);
const OFFLINE_PAYMENT_TYPES: ReadonlySet<string> = new Set(['cash', 'terminal']);

/** Where an order stands, as the buyer needs to hear it. */
export type OrderStage =
  /** Online payment not made yet. */
  | 'awaiting_payment'
  /** Cash or terminal: waits for an operator to confirm it. */
  | 'awaiting_confirmation'
  /** Accepted and being put together. */
  | 'preparing'
  /** On its way to the buyer, or to the pickup point. */
  | 'on_the_way'
  /** A pickup order that has arrived: the buyer can collect it. */
  | 'ready_for_pickup'
  /** A courier order handed over. */
  | 'delivered'
  /** Paid and given back. */
  | 'refunded';

/** A list row, or an order's detail (which has no list pill: `status` is then absent). */
type StageSource = Partial<Pick<OrderListRow, 'status'>> &
  Pick<OrderListRow, 'serverStatus' | 'paymentType' | 'deliveryMethod'>;

/** Cancelled or expired: never listed. */
export function isClosedOrder(
  row: Partial<Pick<OrderListRow, 'status'>> & Pick<OrderListRow, 'serverStatus'>,
): boolean {
  return row.serverStatus ? CLOSED_STATUSES.has(row.serverStatus) : row.status === 'Cancelled';
}

/** The stage of an order, or null for a closed one or a status word the app does not know. */
export function orderStage(row: StageSource): OrderStage | null {
  switch (row.serverStatus) {
    case 'pending_payment':
      return row.paymentType && OFFLINE_PAYMENT_TYPES.has(row.paymentType)
        ? 'awaiting_confirmation'
        : 'awaiting_payment';
    case 'paid':
    case 'confirmed':
    case 'packed':
    case 'processing':
      return 'preparing';
    case 'shipped':
    case 'in_transit':
    case 'out_for_delivery':
      return 'on_the_way';
    case 'delivered':
      return row.deliveryMethod === 'pickup' ? 'ready_for_pickup' : 'delivered';
    case 'refunded':
      return 'refunded';
    case undefined:
    case '':
      break;
    default:
      return null;
  }
  // No status word from the source: the list pill is all there is.
  switch (row.status) {
    case 'Processing':
      return 'preparing';
    case 'In Transit':
    case 'Out for delivery':
      return 'on_the_way';
    case 'Delivered':
      return row.deliveryMethod === 'pickup' ? 'ready_for_pickup' : 'delivered';
    case 'Refunded':
      return 'refunded';
    default:
      return null;
  }
}

/** Delivered within the last `days`, by the backend's `delivered_at`. Unknown reads as no. */
function deliveredWithin(row: Pick<OrderListRow, 'deliveredAt'>, days: number, now: number): boolean {
  const at = row.deliveredAt ? Date.parse(row.deliveredAt) : Number.NaN;
  return Number.isFinite(at) && now - at <= days * DAY_MS;
}

/** Still under way, or (pickup) waiting at its pickup point to be collected. */
export function isActiveOrder(
  row: StageSource & Pick<OrderListRow, 'deliveredAt'>,
  now: number = Date.now(),
): boolean {
  if (isClosedOrder(row)) return false;
  const stage = orderStage(row);
  if (stage === 'ready_for_pickup') return deliveredWithin(row, PICKUP_CARD_DAYS, now);
  if (row.serverStatus) return !DONE_STATUSES.has(row.serverStatus);
  return stage !== null && stage !== 'delivered' && stage !== 'refunded';
}

export type OrdersTab = 'active' | 'all';

/** The rows of one "My orders" tab, in the backend's order (newest first). */
export function ordersForTab<T extends OrderListRow>(
  rows: readonly T[],
  tab: OrdersTab,
  now: number = Date.now(),
): T[] {
  const listed = rows.filter((row) => !isClosedOrder(row));
  return tab === 'active' ? listed.filter((row) => isActiveOrder(row, now)) : listed;
}

/** What needs the buyer first: paying, then collecting, then what is coming to them. */
const CARD_PRIORITY: Record<OrderStage, number> = {
  awaiting_payment: 0,
  ready_for_pickup: 1,
  on_the_way: 2,
  awaiting_confirmation: 3,
  preparing: 4,
  delivered: 5,
  refunded: 6,
};

export type StatusCardOrder<T extends OrderListRow = OrderListRow> = { row: T; stage: OrderStage };

/** The orders for the status card, most pressing first, newest first within a stage. */
export function statusCardOrders<T extends OrderListRow>(
  rows: readonly T[],
  now: number = Date.now(),
): StatusCardOrder<T>[] {
  const shown = rows.flatMap((row, index): (StatusCardOrder<T> & { index: number })[] => {
    const stage = orderStage(row);
    if (!stage || stage === 'refunded' || isClosedOrder(row)) return [];
    if (stage === 'delivered' && !deliveredWithin(row, DELIVERED_CARD_DAYS, now)) return [];
    if (stage !== 'delivered' && !isActiveOrder(row, now)) return [];
    return [{ row, stage, index }];
  });
  // The backend lists newest first, so its order breaks ties within a stage.
  shown.sort((a, b) => CARD_PRIORITY[a.stage] - CARD_PRIORITY[b.stage] || a.index - b.index);
  return shown.map(({ row, stage }) => ({ row, stage }));
}

/** i18n keys of each stage: a short title (pill, card) and the card's line under it. */
export const ORDER_STAGE_I18N: Record<OrderStage, { title: string; body: string }> = {
  awaiting_payment: { title: 'orderStage.awaitingPayment', body: 'orderStage.awaitingPaymentBody' },
  awaiting_confirmation: {
    title: 'orderStage.awaitingConfirmation',
    body: 'orderStage.awaitingConfirmationBody',
  },
  preparing: { title: 'orderStage.preparing', body: 'orderStage.preparingBody' },
  on_the_way: { title: 'orderStage.onTheWay', body: 'orderStage.onTheWayBody' },
  ready_for_pickup: { title: 'orderStage.readyForPickup', body: 'orderStage.readyForPickupBody' },
  delivered: { title: 'orderStage.delivered', body: 'orderStage.deliveredBody' },
  refunded: { title: 'orderStage.refunded', body: 'orderStage.refundedBody' },
};

/** The line under the title, for a stage whose words depend on how the order travels. */
export function orderStageBodyKey(
  stage: OrderStage,
  deliveryMethod: OrderListRow['deliveryMethod'],
): string {
  if (stage === 'on_the_way' && deliveryMethod === 'pickup') return 'orderStage.onTheWayPickupBody';
  return ORDER_STAGE_I18N[stage].body;
}

export type OrderStageTone = 'warning' | 'brand' | 'success' | 'muted';

/** Waiting on the buyer is a warning, under way is the brand colour, done is success. */
export function orderStageTone(stage: OrderStage): OrderStageTone {
  switch (stage) {
    case 'awaiting_payment':
    case 'awaiting_confirmation':
      return 'warning';
    case 'preparing':
    case 'on_the_way':
      return 'brand';
    case 'ready_for_pickup':
    case 'delivered':
      return 'success';
    default:
      return 'muted';
  }
}
