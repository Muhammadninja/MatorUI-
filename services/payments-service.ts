/**
 * Payments transport — turns a `pending_payment` order into an online payment
 * session (Payme today; Click/other later).
 *
 * Flow: checkout creates the order (`POST /v1/orders` → status `pending_payment`),
 * then for `paymentType: 'payme'` the client calls `startPayment()` to get a
 * hosted checkout URL, opens it in an auth-session browser, and lets the user
 * pay. The BACKEND webhook (Payme → server) is the source of truth for whether
 * the order is actually paid; the client only reflects the browser outcome and
 * always lands the user on the order-confirmation screen, which renders the real
 * status from `GET /v1/orders/:id`.
 *
 * Backend contract (PROPOSED — build to ship online Payme):
 *   POST /v1/orders/:orderId/payment
 *     body: { provider: "payme", return_url: "mator://payment-return" }
 *     200 → { checkout_url: "https://checkout.paycom.uz/..." }   // hosted page
 *     404 / 501 → endpoint not live yet
 * Auth'd (bearer). Until it exists it 404s → `startPayment` returns
 * `{ status: 'unsupported' }` (FAIL-OPEN), so checkout behaves exactly as it
 * does today (order placed as pending_payment; pay on delivery / reconcile
 * later) and shipping the UI now is safe. Gated per-domain by
 * `shouldUseHttpTransport('orders')` — payment is order-scoped.
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient, ApiError } from '@/services/api-client';
import { debugLog } from '@/services/debug-log';

export type PaymentProvider = 'payme';

export type StartPaymentInput = {
  /** The just-created `pending_payment` order. */
  orderId: string;
  provider: PaymentProvider;
  /** App deep link the hosted checkout redirects back to when done
   *  (e.g. `mator://payment-return`), used to close the auth session. */
  returnUrl: string;
};

/** `ready` → open `checkoutUrl`. `unsupported` → the gateway isn't live yet, so
 *  the caller should proceed without an online step (today's behavior). */
export type StartPaymentResult =
  | { status: 'ready'; checkoutUrl: string }
  | { status: 'unsupported' };

export interface PaymentsTransport {
  startPayment(input: StartPaymentInput, signal?: AbortSignal): Promise<StartPaymentResult>;
}

// ── Mock transport ─────────────────────────────────────────────────────
//
// No real gateway on mocks — report `unsupported` so mock/dev checkout flows
// straight to the confirmation screen exactly as it does today, never opening
// a dead browser tab.
class MockPaymentsTransport implements PaymentsTransport {
  async startPayment(): Promise<StartPaymentResult> {
    await delay(150);
    return { status: 'unsupported' };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── HTTP transport ─────────────────────────────────────────────────────

type RawStartPayment = {
  checkout_url?: string | null;
  checkoutUrl?: string | null;
};

class HttpPaymentsTransport implements PaymentsTransport {
  async startPayment(
    input: StartPaymentInput,
    signal?: AbortSignal,
  ): Promise<StartPaymentResult> {
    try {
      const r = await apiClient.post<RawStartPayment>(
        `/v1/orders/${encodeURIComponent(input.orderId)}/payment`,
        { provider: input.provider, return_url: input.returnUrl },
        { signal },
      );
      const checkoutUrl = (r.checkout_url ?? r.checkoutUrl) ?? null;
      if (!checkoutUrl) {
        // 2xx without a URL — treat as not-live rather than opening nothing.
        debugLog('payment', 'startPayment: no checkout_url in response — unsupported');
        return { status: 'unsupported' };
      }
      debugLog('payment', 'startPayment → checkout url ready', { orderId: input.orderId });
      return { status: 'ready', checkoutUrl };
    } catch (err) {
      // Endpoint not live yet (404 / 501) → fail OPEN so the placed order still
      // completes without an online step. Other errors (network/5xx/401) rethrow
      // so the caller can tell the user payment couldn't start.
      if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
        debugLog('payment', 'startPayment: endpoint not live — unsupported (fail open)', {
          status: err.status,
        });
        return { status: 'unsupported' };
      }
      throw err;
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

export const paymentsTransport: PaymentsTransport = shouldUseHttpTransport('orders')
  ? new HttpPaymentsTransport()
  : new MockPaymentsTransport();

export default paymentsTransport;
