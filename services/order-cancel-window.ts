/**
 * The 20-minute window an unconfirmed order lives in. An order still in
 * `pending_payment` is cancelled once it runs out, and until then the buyer can
 * cancel it themselves. Pure: screens, hooks and tests share it.
 *
 * The backend owns the real rule and must cancel on its own (an app that is
 * closed cancels nothing). The app counts down from what the server stated and
 * asks the server to cancel at zero; the server may refuse with 409.
 */

/** How long an order may wait for payment or confirmation before it is cancelled. */
export const ORDER_CANCEL_WINDOW_MS = 20 * 60_000;

export type CancelWindowSource = {
  /** Backend's own status word (`pending_payment`, `paid`, …). */
  serverStatus?: string | null;
  /** ISO time the order was created. */
  createdAt?: string | null;
  /** ISO time the backend will expire the order, when it says. */
  expiresAt?: string | null;
};

/**
 * When the order is cancelled, in epoch ms, or null when no window applies:
 * the order is past waiting, or the server gave no creation time. An earlier
 * server expiry wins, so the app never shows more time than the backend allows.
 */
export function orderCancelDeadline(order: CancelWindowSource): number | null {
  if (order.serverStatus !== 'pending_payment') return null;
  const created = order.createdAt ? Date.parse(order.createdAt) : NaN;
  if (!Number.isFinite(created)) return null;
  const deadline = created + ORDER_CANCEL_WINDOW_MS;
  const expires = order.expiresAt ? Date.parse(order.expiresAt) : NaN;
  return Number.isFinite(expires) ? Math.min(deadline, expires) : deadline;
}

/** Whether the buyer can still cancel this order from the app. */
export function canCancelOrder(order: CancelWindowSource, now: number = Date.now()): boolean {
  const deadline = orderCancelDeadline(order);
  return deadline !== null && now < deadline;
}

/** Remaining time as "m:ss" ("19:05", "0:42"); never negative. */
export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
