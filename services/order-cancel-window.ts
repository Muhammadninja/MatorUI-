/**
 * Payment deadline and cancellation of an unpaid order. The backend owns both rules;
 * this module only reads what the order response states. Pure: screens, hooks and
 * tests share it.
 *
 *   • Deadline: an ONLINE (Payme) order waiting in `pending_payment` expires at the
 *     backend's `expires_at` (ORDER_TTL_MIN, 30 minutes by default). While a Payme
 *     transaction is open the backend suspends that expiry (`expiry_suspended`), so no
 *     deadline is shown. Cash and terminal orders have no deadline: they wait for an
 *     operator (OFFLINE_ORDER_TIMEOUT_HOURS=0).
 *   • The countdown only displays time. Reaching zero changes nothing: the app never
 *     cancels on a timer, it re-reads the order and shows whatever the backend says.
 *   • Cancelling by hand: `POST /v1/orders/:id/cancel` accepts the buyer's own order while
 *     it waits in `pending_payment`: an online order not yet paid, or a cash or terminal
 *     order with nothing collected. The server decides; 409 if it cannot (paid meanwhile,
 *     or an operator has taken it up).
 */

import type { CartItem } from '@/services/cart-math';

/** Payment types that wait for an operator rather than an online payment. */
const OFFLINE_PAYMENT_TYPES: ReadonlySet<string> = new Set(['cash', 'terminal']);

export type CancelWindowSource = {
  /** Backend's own status word (`pending_payment`, `paid`, …). */
  serverStatus?: string | null;
  /** `payme` | `terminal` | `cash`, when the backend says. */
  paymentType?: string | null;
  /** ISO time the backend will expire the unpaid order. */
  expiresAt?: string | null;
  /** The backend has suspended expiry: a Payme transaction is open. */
  expirySuspended?: boolean | null;
};

/**
 * When the backend expires this order, in epoch ms, or null when there is no deadline
 * to show: not waiting for payment, a cash/terminal order, expiry suspended, or no
 * usable `expires_at`. Never a client-side constant.
 */
export function orderPaymentDeadline(order: CancelWindowSource): number | null {
  if (order.serverStatus !== 'pending_payment') return null;
  if (order.paymentType && OFFLINE_PAYMENT_TYPES.has(order.paymentType)) return null;
  if (order.expirySuspended) return null;
  const expires = order.expiresAt ? Date.parse(order.expiresAt) : NaN;
  return Number.isFinite(expires) ? expires : null;
}

/** Whether to offer the cancel button: any order still waiting for payment or for an
 *  operator. No timer, and no guess about what the server will accept: it decides. */
export function canCancelOrder(order: CancelWindowSource): boolean {
  return order.serverStatus === 'pending_payment';
}

/** Remaining time as "m:ss" ("19:05", "0:42"); never negative. */
export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** What a cancelled order puts back into the cart: its catalog parts, each at the quantity
 *  ordered. A service or a sourced offer has no part a cart can hold, so it is left out. */
export function orderCartLines(order: {
  items: readonly { partId?: string | null; title: string; quantity: number; price: string }[];
  pricing?: { lines: readonly { unitPrice: number | null }[] } | null;
}): CartItem[] {
  return order.items.flatMap((item, index): CartItem[] => {
    if (!item.partId || !(item.quantity > 0)) return [];
    const unitPrice = order.pricing?.lines[index]?.unitPrice ?? null;
    return [
      {
        id: item.partId,
        title: item.title,
        description: '',
        // The server prices the cart itself; this only fills the line until it answers.
        price: unitPrice === null ? '0' : String(unitPrice),
        priceLabel: item.price,
        quantity: item.quantity,
      },
    ];
  });
}
