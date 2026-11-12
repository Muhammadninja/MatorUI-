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
import { orderPaymentState, type PaymentFailureReason } from '@/services/checkout-presentation';
import { payOrder, readOrderPaymentState } from '@/services/order-payment';
import type { OrderDetail } from '@/services/orders-service';
import { getAuthRequestEpoch } from '@/services/api-client';
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

/** A retained action belongs to this mounted owner and auth generation only. */
function usePaymentSession(ownerId: string | null): () => boolean {
  const epoch = getAuthRequestEpoch();
  const identity = useRef({ ownerId, epoch });
  if (identity.current.ownerId !== ownerId || identity.current.epoch !== epoch) {
    identity.current = { ownerId, epoch };
  }
  const session = identity.current;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(
    () =>
      mounted.current && identity.current === session && getAuthRequestEpoch() === session.epoch,
    [session],
  );
}

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
  const isCurrent = usePaymentSession(ownerId);
  const inFlight = useRef<(() => boolean) | null>(null);
  const stateSession = useRef(isCurrent);

  const [phase, setPhase] = useState<PaymentPhase>('checking');
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [failure, setFailure] = useState<PaymentFailureReason | null>(null);
  const [orderClosed, setOrderClosed] = useState(false);
  const visiblePending = stateSession.current === isCurrent ? pending : null;
  const { order } = useOrder(visiblePending?.orderId ?? null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  /** Paid, so the cart it came from is done with. A cart changed since is another purchase. */
  const finish = useCallback(
    async (record: PendingPayment) => {
      if (!isCurrent()) return;
      if (record.cartKey === cartKeyOf(itemsRef.current)) clearCart();
      await clearPendingPayment(ownerId);
      if (!isCurrent()) return;
      setPending(null);
      setFailure(null);
      onPaidRef.current(record.orderId);
    },
    [clearCart, ownerId, isCurrent],
  );

  const close = useCallback(async () => {
    if (!isCurrent()) return;
    await clearPendingPayment(ownerId);
    if (!isCurrent()) return;
    setPending(null);
    setFailure(null);
    setOrderClosed(true);
  }, [ownerId, isCurrent]);

  const collect = useCallback(
    async (record: PendingPayment) => {
      if (!isCurrent() || inFlight.current?.()) return;
      const attempt = () => isCurrent();
      inFlight.current = attempt;
      setPhase('paying');
      setFailure(null);
      setOrderClosed(false);
      try {
        // Before anything else, so a crash mid-payment cannot lead to a second order.
        await savePendingPayment(ownerId, record);
        if (!isCurrent()) return;

        const outcome = await payOrder(record.orderId, isCurrent);
        if (!isCurrent()) return;

        if (outcome.kind === 'paid' || outcome.kind === 'no_online_step') {
          await finish(record);
        } else {
          const restored = await restoreCart();
          if (!isCurrent()) return;
          if (outcome.kind === 'closed') {
            await close();
          } else {
            const next = { ...record, cartKey: cartKeyOf(restored) };
            await savePendingPayment(ownerId, next);
            if (!isCurrent()) return;
            setPending(next);
            setFailure(outcome.reason);
          }
        }
      } finally {
        if (inFlight.current === attempt) {
          inFlight.current = null;
          if (isCurrent()) setPhase('idle');
        }
      }
    },
    [ownerId, finish, restoreCart, close, isCurrent],
  );

  const retry = useCallback(async () => {
    if (visiblePending) await collect(visiblePending);
  }, [visiblePending, collect]);

  const startOver = useCallback(async () => {
    if (!isCurrent() || inFlight.current?.()) return;
    await clearPendingPayment(ownerId);
    if (!isCurrent()) return;
    setPending(null);
    setFailure(null);
  }, [ownerId, isCurrent]);

  // Coming back to the checkout: an order left unpaid is offered before a new one can be
  // placed, and one paid in the meantime is finished with.
  useEffect(() => {
    let cancelled = false;
    stateSession.current = isCurrent;
    setPending(null);
    setFailure(null);
    setOrderClosed(false);
    setPhase('checking');
    const current = () => !cancelled && isCurrent() && !inFlight.current?.();
    void (async () => {
      if (!current()) return;
      const record = await loadPendingPayment(ownerId);
      if (!current()) return;
      const state = record ? await readOrderPaymentState(record.orderId, current) : null;
      if (!current()) return;
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
      if (current()) setPhase('idle');
    })();
    return () => {
      cancelled = true;
    };
    // Once per screen and account. `finish` only reads the latest values through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, isCurrent]);

  // The order is polled while it is on screen, so a webhook arriving late moves the buyer on
  // without them doing anything.
  const polled = orderPaymentState(order?.serverStatus);
  useEffect(() => {
    if (!visiblePending || phase !== 'idle' || !isCurrent() || inFlight.current?.()) return;
    if (polled === 'settled') void finish(visiblePending);
    if (polled === 'closed') void close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polled, visiblePending, phase, isCurrent]);

  return {
    phase: stateSession.current === isCurrent ? phase : 'checking',
    pending: visiblePending,
    order: visiblePending ? order : null,
    failure: stateSession.current === isCurrent ? failure : null,
    orderClosed: stateSession.current === isCurrent && orderClosed,
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
  const isCurrent = usePaymentSession(ownerId);
  const inFlight = useRef<(() => boolean) | null>(null);
  const stateSession = useRef(isCurrent);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [paying, setPaying] = useState(false);
  const [failure, setFailure] = useState<PaymentFailureReason | null>(null);
  useEffect(() => {
    stateSession.current = isCurrent;
    setPaying(false);
    setFailure(null);
  }, [isCurrent]);

  const pay = useCallback(async () => {
    if (!orderId || !isCurrent() || inFlight.current?.()) return;
    const attempt = () => isCurrent();
    inFlight.current = attempt;
    setPaying(true);
    setFailure(null);
    try {
      const outcome = await payOrder(orderId, isCurrent);
      if (!isCurrent()) return;
      if (outcome.kind === 'paid') {
        // The checkout may have put this order's lines back in the cart when it went unpaid.
        const record = await loadPendingPayment(ownerId);
        if (!isCurrent()) return;
        if (record?.orderId === orderId) {
          if (record.cartKey === cartKeyOf(itemsRef.current)) clearCart();
          await clearPendingPayment(ownerId);
          if (!isCurrent()) return;
        }
      } else if (outcome.kind === 'failed') {
        setFailure(outcome.reason);
      }
      refresh();
    } finally {
      if (inFlight.current === attempt) {
        inFlight.current = null;
        if (isCurrent()) setPaying(false);
      }
    }
  }, [orderId, ownerId, clearCart, refresh, isCurrent]);

  return {
    paying: stateSession.current === isCurrent && paying,
    failure: stateSession.current === isCurrent ? failure : null,
    pay,
  };
}
