/**
 * Payments transport — turns a `pending_payment` order into an online payment
 * session (Payme today; Click/other later).
 *
 * Flow: checkout creates the order (`POST /v1/orders` → status `pending_payment`),
 * then for `paymentType: 'payme'` the client calls `startPayment()` to get a
 * hosted checkout URL, opens it in an auth-session browser, and lets the user
 * pay. The BACKEND webhook (Payme → server) is the source of truth for whether
 * the order is actually paid: see `services/order-payment.ts`, which reads the
 * order's status back before anything is called paid.
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
 *
 * Any refusal surfaces as a rejected promise carrying the server's code, among
 * them 400 FISCAL_DATA_INCOMPLETE and 409 PART_UNAVAILABLE. None of them is
 * treated as "nothing to pay": the order is still unpaid, and saying otherwise
 * is how a buyer ends up on a confirmation screen for an order that expires.
 * Gated per-domain by `shouldUseHttpTransport('orders')` — payment is
 * order-scoped (there is no separate `payments` HTTP domain flag).
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient, ApiError } from '@/services/api-client';
import { debugLog } from '@/services/debug-log';
import { isStagingBuild } from '@/services/staging-access';

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
 *  `unsupported` → this transport has no gateway at all, which only the mock says:
 *  a real backend either gives a link or refuses, and a refusal rejects. */
export type StartPaymentResult =
  | { status: 'ready'; checkoutUrl: string; paymentId?: string }
  | { status: 'unsupported' };

export interface PaymentsTransport {
  startPayment(input: StartPaymentInput, signal?: AbortSignal): Promise<StartPaymentResult>;
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
    // Staging never opens a real Payme/Click checkout, whatever the staging
    // server is configured with. The server must also refuse (see
    // docs/staging/ios-staging.md); this only keeps the app from asking.
    if (isStagingBuild()) {
      throw new ApiError(403, 'STAGING_PAYMENTS_DISABLED', 'Online payment is disabled in staging builds.');
    }
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
      // There is nothing to open, so the buyer cannot pay: a failure, not a free pass.
      throw new ApiError(502, 'PAYMENT_LINK_MISSING', 'The payment provider gave no link.');
    }
    debugLog('payment', 'startPayment → checkout url ready', { orderId: input.orderId });
    return { status: 'ready', checkoutUrl, paymentId: r.payment_id ?? undefined };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

export const paymentsTransport: PaymentsTransport = new HttpPaymentsTransport();

export default paymentsTransport;
