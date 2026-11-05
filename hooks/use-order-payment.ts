/**
 * Paying online for an order, and what happens around a payment that does not go through.
 * The order and the status are the backend's. What the app keeps straight is the buyer's
 * position: the order stays one order, the cart stays theirs until it is actually paid, and
 * a confirmation is only ever shown for what the backend says is paid.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useCartContext } from '@/contexts/cart.context';
import { useUserContext } from '@/contexts/user.context';
import { useOrder } from '@/hooks/use-orders';
import {
  orderPaymentState,
  type PaymentFailureReason,
} from '@/services/checkout-presentation';
import { payOrder, readOrderPaymentState } from '@/services/order-payment';
import type { OrderDetail } from '@/services/orders-service';
import {
  clearPendingPayment,
  loadPendingPayment,
  savePendingPayment,
  type PendingPayment,
} from '@/services/pending-payment-storage';

/** Which lines and how many, so a cart can be told from the one an order came from. */
export function cartKeyOf(items: readonly { id: string; quantity: number }[]): string {
  return items
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join(',');
}

export type PaymentPhase = 'checking' | 'idle' | 'paying';

export type UseCheckoutPaymentValue = {
  /** 'checking': looking for an unpaid order from before, so nothing may be placed yet. */
  phase: PaymentPhase;
  /** The unpaid order the buyer can pay or give up on. While set, no new order is placed. */
  pending: PendingPayment | null;
  /** That order, as the backend has it, when it has been read. */
  order: OrderDetail | null;
  failure: PaymentFailureReason | null;
  /** The last order expired or was cancelled unpaid, so it is a new order from here. */
  orderClosed: boolean;
  /** Pays a just-created order. */
  collect: (record: PendingPayment) => Promise<void>;
  /** Pays the pending order again. Never creates one. */
  retry: () => Promise<void>;
  /** Leaves the pending order to expire, and goes back to placing a new one. */
  startOver: () => Promise<void>;
};

export function useCheckoutPayment(onPaid: (orderId: string) => void): UseCheckoutPaymentValue {
  const { items, clearCart, restoreCart } = useCartContext();
  const { profile } = useUserContext();
  const ownerId = profile?.id ?? null;

  const [phase, setPhase] = useState<PaymentPhase>('checking');
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [failure, setFailure] = useState<PaymentFailureReason | null>(null);
  const [orderClosed, setOrderClosed] = useState(false);
  const { order } = useOrder(pending?.orderId ?? null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  /** Paid, so the cart it came from is done with. A cart changed since is another purchase. */
  const finish = useCallback(
    async (record: PendingPayment) => {
      if (record.cartKey === cartKeyOf(itemsRef.current)) clearCart();
      await clearPendingPayment(ownerId);
      setPending(null);
      setFailure(null);
      onPaidRef.current(record.orderId);
    },
    [clearCart, ownerId],
  );

  const close = useCallback(async () => {
    await clearPendingPayment(ownerId);
    setPending(null);
    setFailure(null);
    setOrderClosed(true);
  }, [ownerId]);

  const collect = useCallback(
    async (record: PendingPayment) => {
      setPhase('paying');
      setFailure(null);
      setOrderClosed(false);
      // Before anything else, so a crash mid-payment cannot lead to a second order.
      await savePendingPayment(ownerId, record);

      const outcome = await payOrder(record.orderId);

      if (outcome.kind === 'paid' || outcome.kind === 'no_online_step') {
        await finish(record);
      } else {
        const restored = await restoreCart();
        if (outcome.kind === 'closed') {
          await close();
        } else {
          const next = { ...record, cartKey: cartKeyOf(restored) };
          await savePendingPayment(ownerId, next);
          setPending(next);
          setFailure(outcome.reason);
        }
      }
      setPhase('idle');
    },
    [ownerId, finish, restoreCart, close],
  );

  const retry = useCallback(async () => {
    if (pending) await collect(pending);
  }, [pending, collect]);

  const startOver = useCallback(async () => {
    await clearPendingPayment(ownerId);
    setPending(null);
    setFailure(null);
  }, [ownerId]);

  // Coming back to the checkout: an order left unpaid is offered before a new one can be
  // placed, and one paid in the meantime is finished with.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const record = await loadPendingPayment(ownerId);
      const state = record ? await readOrderPaymentState(record.orderId) : null;
      if (cancelled) return;
      if (record && state === 'settled') {
        // Only jump to its confirmation if this is still the cart it came from: otherwise
        // the buyer is here to order something else.
        if (record.cartKey === cartKeyOf(itemsRef.current)) await finish(record);
        else await clearPendingPayment(ownerId);
      } else if (record && state === 'closed') {
        await clearPendingPayment(ownerId);
      } else if (record) {
        setPending(record);
        setFailure('unpaid');
      }
      if (!cancelled) setPhase('idle');
    })();
    return () => {
      cancelled = true;
    };
    // Once per screen and account. `finish` only reads the latest values through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  // The order is polled while it is on screen, so a webhook arriving late moves the buyer on
  // without them doing anything.
  const polled = orderPaymentState(order?.serverStatus);
  useEffect(() => {
    if (!pending || phase !== 'idle') return;
    if (polled === 'settled') void finish(pending);
    if (polled === 'closed') void close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polled, pending, phase]);

  return {
    phase,
    pending,
    order: pending ? order : null,
    failure,
    orderClosed,
    collect,
    retry,
    startOver,
  };
}

export type UseRecoverPaymentValue = {
  paying: boolean;
  failure: PaymentFailureReason | null;
  pay: () => Promise<void>;
};

/** Paying an unpaid order from outside the checkout, such as from its tracking screen. */
export function useRecoverPayment(
  orderId: string | null | undefined,
  refresh: () => void,
): UseRecoverPaymentValue {
  const { items, clearCart } = useCartContext();
  const { profile } = useUserContext();
  const ownerId = profile?.id ?? null;
  const [paying, setPaying] = useState(false);
  const [failure, setFailure] = useState<PaymentFailureReason | null>(null);

  const pay = useCallback(async () => {
    if (!orderId || paying) return;
    setPaying(true);
    setFailure(null);
    const outcome = await payOrder(orderId);
    if (outcome.kind === 'paid') {
      // The checkout may have put this order's lines back in the cart when it went unpaid.
      const record = await loadPendingPayment(ownerId);
      if (record?.orderId === orderId) {
        if (record.cartKey === cartKeyOf(items)) clearCart();
        await clearPendingPayment(ownerId);
      }
    } else if (outcome.kind === 'failed') {
      setFailure(outcome.reason);
    }
    setPaying(false);
    refresh();
  }, [orderId, paying, ownerId, items, clearCart, refresh]);

  return { paying, failure, pay };
}
