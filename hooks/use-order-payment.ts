/**
 * Paying online for an order, and what happens around a payment that does not go through.
 * The order and the status are the backend's. What the app keeps straight is the buyer's
 * position: the order stays one order, the cart stays theirs until it is actually paid, and
 * a confirmation is only ever shown for what the backend says is paid.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useCartContext } from '@/contexts/cart.context';
import { useUserContext } from '@/contexts/user.context';
import { useOrder, useRefreshOrders } from '@/hooks/use-orders';
import {
  orderPaymentState,
  type OrderPaymentState,
  type PaymentFailureReason,
} from '@/services/checkout-presentation';
import { payOrder, readOrderPaymentState } from '@/services/order-payment';
import { ordersTransport } from '@/services/orders-api';
import type { OrderDetail } from '@/services/orders-service';
import { ApiError, getAuthRequestEpoch } from '@/services/api-client';
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

export type PaymentPhase = 'checking' | 'idle' | 'paying' | 'cancelling';

/** Why a cancel did not go through: the server refused it (409), or it could not be asked. */
export type CancelFailure = 'refused' | 'failed';

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
  /** The unpaid order from this same cart, which the buyer can pay or cancel. While set, no
   *  new order is placed: the cart on screen is the one that order was placed with. */
  pending: PendingPayment | null;
  /** An unpaid order from another cart. The buyer is here to buy something else, so the
   *  checkout stays open for that: this order is only offered, to pay or to cancel. */
  otherUnpaid: PendingPayment | null;
  /** The unpaid order (either of the above), as the backend has it, when it has been read. */
  order: OrderDetail | null;
  failure: PaymentFailureReason | null;
  /** The last order expired or was cancelled unpaid, so it is a new order from here. */
  orderClosed: boolean;
  /** Pays a just-created order. */
  collect: (record: PendingPayment) => Promise<void>;
  /** Pays the pending order again. Never creates one. */
  retry: () => Promise<void>;
  /** Cancels the unpaid order on the backend, then goes back to placing a new one. True
   *  when the backend cancelled it. */
  cancelUnpaid: () => Promise<boolean>;
  cancelFailure: CancelFailure | null;
  /** The order the buyer just cancelled here, so the screen can say so. */
  cancelledOrderId: string | null;
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
  const [cancelFailure, setCancelFailure] = useState<CancelFailure | null>(null);
  const [cancelledOrderId, setCancelledOrderId] = useState<string | null>(null);
  const refreshOrders = useRefreshOrders();
  const visiblePending = stateSession.current === isCurrent ? pending : null;
  // Only the cart that order was placed with is held to it. A changed cart is another purchase.
  const blocking = !!visiblePending && visiblePending.cartKey === cartKeyOf(items);
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

  /** The other cart's order moved on by itself (paid, or closed): nothing to offer any more. */
  const forget = useCallback(async () => {
    if (!isCurrent()) return;
    await clearPendingPayment(ownerId);
    if (!isCurrent()) return;
    setPending(null);
    setFailure(null);
  }, [ownerId, isCurrent]);

  const collect = useCallback(
    async (record: PendingPayment) => {
      if (!isCurrent() || inFlight.current?.()) return;
      const attempt = () => isCurrent();
      inFlight.current = attempt;
      setPhase('paying');
      setFailure(null);
      setOrderClosed(false);
      setCancelFailure(null);
      setCancelledOrderId(null);
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

  const cancelUnpaid = useCallback(async (): Promise<boolean> => {
    const record = visiblePending;
    if (!record || !isCurrent() || inFlight.current?.()) return false;
    const attempt = () => isCurrent();
    inFlight.current = attempt;
    setPhase('cancelling');
    setCancelFailure(null);
    setCancelledOrderId(null);
    try {
      let state: OrderPaymentState;
      try {
        const cancelled = await ordersTransport.cancelOrder(record.orderId);
        state = orderPaymentState(cancelled.serverStatus);
      } catch (error) {
        if (!isCurrent()) return false;
        // A refusal can mean the order moved on (paid meanwhile, taken up by an operator):
        // its own status says which before this is called a failure.
        state = await readOrderPaymentState(record.orderId, isCurrent);
        if (!isCurrent()) return false;
        if (state !== 'settled' && state !== 'closed') {
          setCancelFailure(error instanceof ApiError && error.status === 409 ? 'refused' : 'failed');
          return false;
        }
      }
      if (!isCurrent()) return false;
      if (state === 'closed') {
        await clearPendingPayment(ownerId);
        if (!isCurrent()) return false;
        setPending(null);
        setFailure(null);
        setOrderClosed(false);
        setCancelledOrderId(record.orderId);
        return true;
      } else if (state === 'settled') {
        // Paid before the cancel reached it: the order stands, like any other payment.
        if (record.cartKey === cartKeyOf(itemsRef.current)) await finish(record);
        else await forget();
      } else {
        setCancelFailure('failed');
      }
      return false;
    } finally {
      // Every list and card reads the order's new status.
      refreshOrders();
      if (inFlight.current === attempt) {
        inFlight.current = null;
        if (isCurrent()) setPhase('idle');
      }
    }
  }, [visiblePending, ownerId, finish, forget, isCurrent, refreshOrders]);

  // Coming back to the checkout: an order left unpaid is offered before a new one can be
  // placed, and one paid in the meantime is finished with.
  useEffect(() => {
    let cancelled = false;
    stateSession.current = isCurrent;
    setPending(null);
    setFailure(null);
    setOrderClosed(false);
    setCancelFailure(null);
    setCancelledOrderId(null);
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
  // without them doing anything. Another cart's order is only let go of: the buyer is busy
  // with this one, and is never taken to that order's confirmation.
  const polled = orderPaymentState(order?.serverStatus);
  useEffect(() => {
    if (!visiblePending || phase !== 'idle' || !isCurrent() || inFlight.current?.()) return;
    if (polled === 'settled') void (blocking ? finish(visiblePending) : forget());
    if (polled === 'closed') void (blocking ? close() : forget());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polled, visiblePending, phase, isCurrent, blocking]);

  const current = stateSession.current === isCurrent;
  return {
    phase: current ? phase : 'checking',
    pending: blocking ? visiblePending : null,
    otherUnpaid: blocking ? null : visiblePending,
    order: visiblePending ? order : null,
    failure: current && blocking ? failure : null,
    orderClosed: current && orderClosed,
    collect,
    retry,
    cancelUnpaid,
    cancelFailure: current ? cancelFailure : null,
    cancelledOrderId: current ? cancelledOrderId : null,
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
