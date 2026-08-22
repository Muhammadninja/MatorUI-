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
 * Backend contract (LIVE — mator.uz `PaymentsController('v1/payments')`):
 *   POST /v1/payments/payme/invoices   (also /click/invoices) — auth'd bearer
 *     body: { order_id: string, return_url?: "mator://payment-return" }
 *     201 → {
 *       payment_id, provider, amount_uzs, amount_tiyin?,
 *       deep_link,        // official Payme/Click checkout URL — open this
 *       https_fallback,   // same link (https), used if deep_link can't open
 *       expires_at
 *     }
 *   GET /v1/payments/:paymentId → { status, order: { status, next_screen } }
 * Auth'd (bearer). If the endpoint 404s (older backend) or the order can't be
 * charged online (400 — e.g. dealer fiscal data missing), `startPayment` returns
 * `{ status: 'unsupported' }` (FAIL-OPEN), so checkout completes exactly as it
 * does for cash/terminal (order stays pending_payment; pay on delivery /
 * reconcile later). Gated per-domain by `shouldUseHttpTransport('orders')` —
 * payment is order-scoped (there is no separate `payments` HTTP domain flag).
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient, ApiError } from '@/services/api-client';
import { debugLog } from '@/services/debug-log';

/** Online gateways the backend can create an invoice with. */
export type PaymentProvider = 'payme' | 'click';

export type StartPaymentInput = {
  /** The just-created `pending_payment` order. */
  orderId: string;
  provider: PaymentProvider;
  /** App deep link the hosted checkout redirects back to when done
   *  (e.g. `mator://payment-return`), used to close the auth session. */
  returnUrl: string;
};

/** `ready` → open `checkoutUrl` (poll the order for the webhook-confirmed
 *  status; `paymentId` allows GET /v1/payments/:id if a finer check is needed).
 *  `unsupported` → no online step available, proceed as pay-on-delivery. */
export type StartPaymentResult =
  | { status: 'ready'; checkoutUrl: string; paymentId?: string }
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

/** Shape of `POST /v1/payments/:provider/invoices` (snake_case from NestJS). */
type RawInvoice = {
  payment_id?: string | null;
  deep_link?: string | null;
  https_fallback?: string | null;
  // Tolerate a camelCase / legacy `checkout_url` backend without breaking.
  checkout_url?: string | null;
  checkoutUrl?: string | null;
};

class HttpPaymentsTransport implements PaymentsTransport {
  async startPayment(
    input: StartPaymentInput,
    signal?: AbortSignal,
  ): Promise<StartPaymentResult> {
    try {
      const r = await apiClient.post<RawInvoice>(
        `/v1/payments/${input.provider}/invoices`,
        { order_id: input.orderId, return_url: input.returnUrl },
        { signal },
      );
      // Prefer the deep link (hands off to the installed Payme/Click app),
      // fall back to the https page, then any legacy checkout_url field.
      const checkoutUrl =
        r.deep_link ?? r.https_fallback ?? r.checkout_url ?? r.checkoutUrl ?? null;
      if (!checkoutUrl) {
        // 2xx without a URL — treat as not-live rather than opening nothing.
        debugLog('payment', 'startPayment: no checkout url in response — unsupported');
        return { status: 'unsupported' };
      }
      debugLog('payment', 'startPayment → checkout url ready', { orderId: input.orderId });
      return { status: 'ready', checkoutUrl, paymentId: r.payment_id ?? undefined };
    } catch (err) {
      // Fail OPEN so the placed order still completes as pay-on-delivery when an
      // online charge can't start:
      //   404/501 → endpoint not live on this backend
      //   400     → order not chargeable online (e.g. dealer fiscal data missing)
      // Other errors (network / 5xx / 401) rethrow so the caller can tell the
      // user payment couldn't start.
      if (
        err instanceof ApiError &&
        (err.status === 404 || err.status === 501 || err.status === 400)
      ) {
        debugLog('payment', 'startPayment: cannot charge online — unsupported (fail open)', {
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
