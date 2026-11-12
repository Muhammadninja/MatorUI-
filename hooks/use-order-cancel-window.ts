import { useEffect, useState } from 'react';

import { useCancelOrder } from '@/hooks/use-orders';
import { orderCancelDeadline, type CancelWindowSource } from '@/services/order-cancel-window';

/** Orders this session has already asked the server to cancel on expiry, so a
 *  list row and the detail screen showing the same order ask only once. */
const expiryCancelRequested = new Set<string>();

export type OrderCancelWindow = {
  /** Time left in ms, or null when the order has no window. */
  remainingMs: number | null;
  /** The window ran out: the order is being, or has been, cancelled. */
  expired: boolean;
  /** Manual cancel, for the detail screen's button. */
  cancel: ReturnType<typeof useCancelOrder>;
};

/**
 * Counts an unconfirmed order down to its cancel deadline, once a second, and
 * asks the server to cancel it when the time is up. The server has the final
 * say: a refusal (it was paid at the last moment) just re-reads the order.
 */
export function useOrderCancelWindow(
  orderId: string | null | undefined,
  order: CancelWindowSource | null | undefined,
): OrderCancelWindow {
  const deadline = order ? orderCancelDeadline(order) : null;
  const cancel = useCancelOrder(orderId);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const remainingMs = deadline === null ? null : Math.max(0, deadline - now);
  const expired = remainingMs === 0;

  const { mutate } = cancel;
  useEffect(() => {
    if (!expired || !orderId || expiryCancelRequested.has(orderId)) return;
    expiryCancelRequested.add(orderId);
    // A 409 means the server already moved the order on; either way the
    // mutation re-reads every order query once it settles.
    mutate(undefined);
  }, [expired, orderId, mutate]);

  return { remainingMs, expired, cancel };
}
