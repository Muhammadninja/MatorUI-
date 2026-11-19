import { useEffect, useState } from 'react';

import { useRefreshOrders } from '@/hooks/use-orders';
import {
  canCancelOrder,
  orderPaymentDeadline,
  type CancelWindowSource,
} from '@/services/order-cancel-window';

export type OrderCancelWindow = {
  /** Time left before the backend's `expires_at`, in ms, or null when there is no deadline. */
  remainingMs: number | null;
  /** The deadline has passed. Display only: the order is unchanged until the backend says. */
  expired: boolean;
  /** Whether the manual cancel button applies: the order still waits in pending_payment.
   *  The cancel itself is `useCancelOrderToCart`, pressed by the buyer, never on a timer. */
  canCancel: boolean;
};

/**
 * Counts an unpaid online order down to the backend's `expires_at`, once a second.
 * At zero it only re-reads the order queries, so the status shown is the backend's.
 * It never cancels and never changes the order itself.
 */
export function useOrderCancelWindow(
  order: CancelWindowSource | null | undefined,
): OrderCancelWindow {
  const deadline = order ? orderPaymentDeadline(order) : null;
  const refreshOrders = useRefreshOrders();
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

  useEffect(() => {
    if (!expired) return;
    // The backend's sweep expires the order; read what it decided.
    refreshOrders();
  }, [expired, refreshOrders]);

  return { remainingMs, expired, canCancel: order ? canCancelOrder(order) : false };
}
