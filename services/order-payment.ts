/**
 * Paying for an order that already exists. Used for the first attempt and for every retry,
 * so a retry can never place a second order: this has no way to.
 *
 * The answer always comes from the order's status on the backend, which the payment webhook
 * sets. Coming back from the payment page does not prove payment, and leaving it does not
 * disprove it: the buyer may have paid in the Payme app first.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { paymentRefusalReason, orderPaymentState } from '@/services/checkout-presentation';
import type { OrderPaymentState, PaymentFailureReason } from '@/services/checkout-presentation';
import { ordersTransport } from '@/services/orders-api';
import { paymentsTransport } from '@/services/payments-service';

export type PaymentOutcome =
  | { kind: 'paid' }
  /** This transport has no gateway (the mock, in development): nothing to pay online. */
  | { kind: 'no_online_step' }
  /** The order expired or was cancelled, so it can no longer be paid. */
  | { kind: 'closed' }
  | { kind: 'failed'; reason: PaymentFailureReason };

/** How long to wait for the webhook after the payment page closes. Adjustable by tests. */
export const PAYMENT_POLL = {
  delayMs: 2_000,
  /** The buyer was sent back by the payment page, so payment is likely on its way. */
  readsAfterReturn: 6,
  /** The buyer closed the page, and may still have paid in the Payme app. */
  readsAfterDismiss: 2,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the backend says about this order now. A failed read says nothing either way. */
export async function readOrderPaymentState(orderId: string): Promise<OrderPaymentState> {
  try {
    const order = await ordersTransport.getOrder(orderId);
    return order ? orderPaymentState(order.serverStatus) : 'closed';
  } catch {
    return 'unknown';
  }
}

async function waitForSettlement(orderId: string, reads: number): Promise<OrderPaymentState> {
  let state: OrderPaymentState = 'unknown';
  for (let read = 0; read < reads; read += 1) {
    if (read > 0) await sleep(PAYMENT_POLL.delayMs);
    state = await readOrderPaymentState(orderId);
    if (state === 'settled' || state === 'closed') return state;
  }
  return state;
}

function errorCodeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

export async function payOrder(orderId: string): Promise<PaymentOutcome> {
  const returnUrl = Linking.createURL('payment-return');

  let start;
  try {
    start = await paymentsTransport.startPayment({ orderId, provider: 'payme', returnUrl });
  } catch (error) {
    // A refusal can also mean the order has moved on: paid on an earlier attempt, or
    // expired. Its own status says which, before this is called a failure.
    const state = await readOrderPaymentState(orderId);
    if (state === 'settled') return { kind: 'paid' };
    if (state === 'closed') return { kind: 'closed' };
    return { kind: 'failed', reason: paymentRefusalReason(errorCodeOf(error)) };
  }
  if (start.status === 'unsupported') return { kind: 'no_online_step' };

  let returned = false;
  try {
    const browser = await WebBrowser.openAuthSessionAsync(start.checkoutUrl, returnUrl);
    returned = browser.type === 'success';
  } catch {
    // The page could not be shown or crashed. The status below still decides.
  }

  const state = await waitForSettlement(
    orderId,
    returned ? PAYMENT_POLL.readsAfterReturn : PAYMENT_POLL.readsAfterDismiss,
  );
  if (state === 'settled') return { kind: 'paid' };
  if (state === 'closed') return { kind: 'closed' };
  return { kind: 'failed', reason: returned ? 'unconfirmed' : 'cancelled' };
}
