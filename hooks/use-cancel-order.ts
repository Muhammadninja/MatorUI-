import { useCallback } from 'react';

import { useCartContext } from '@/contexts/cart.context';
import { useCancelOrder } from '@/hooks/use-orders';
import { orderPaymentState } from '@/services/checkout-presentation';
import { orderCartLines } from '@/services/order-cancel-window';
import type { OrderDetail } from '@/services/orders-service';

export type CancelToCartResult = {
  /** The backend has the order cancelled (or expired) now. */
  cancelled: boolean;
  /** The order's parts are in the cart after it. */
  restoredToCart: boolean;
};

/**
 * Cancelling an order from its own screen, which puts its parts back into the cart. The
 * backend empties the cart when an order is placed, and a cash or terminal order is not paid
 * at checkout, so nothing had put the lines back: the buyer who called the order off lost
 * what they had chosen. (An unpaid Payme order had its lines put back by the checkout already,
 * so for it this adds nothing: only what the cart lacks of each line is added.)
 *
 * Rejects with whatever the cancel request rejected with, so the screen can say why.
 */
export function useCancelOrderToCart(order: OrderDetail | null | undefined) {
  const cancel = useCancelOrder(order?.id);
  const { mutateAsync } = cancel;
  const { restoreCart } = useCartContext();

  const run = useCallback(async (): Promise<CancelToCartResult> => {
    if (!order) return { cancelled: false, restoredToCart: false };
    const after = await mutateAsync();
    if (orderPaymentState(after.serverStatus) !== 'closed') {
      return { cancelled: false, restoredToCart: false };
    }
    const lines = orderCartLines(order);
    if (lines.length === 0) return { cancelled: true, restoredToCart: false };
    try {
      const items = await restoreCart(lines);
      return {
        cancelled: true,
        restoredToCart: lines.some((line) => items.some((item) => item.id === line.id)),
      };
    } catch {
      // The order is cancelled either way; the cart is read again on its own screen.
      return { cancelled: true, restoredToCart: false };
    }
  }, [order, mutateAsync, restoreCart]);

  return { run, isPending: cancel.isPending };
}
