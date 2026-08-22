/**
 * payments-service — HTTP transport contract tests.
 *
 * Pins the LIVE invoice wire contract (POST /v1/payments/:provider/invoices →
 * { deep_link, https_fallback, payment_id }) and the FAIL-OPEN behavior: an
 * endpoint that can't charge online (404/501 not live, or 400 order not
 * chargeable) must degrade to `unsupported` so a placed order still completes,
 * while a real transport error (network/5xx) must surface so the caller can
 * tell the buyer payment couldn't start.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Force the HTTP transport singleton (payment is gated on the `orders` domain).
vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => true,
}));

// Controlled apiClient — keep the REAL ApiError so `instanceof` status checks work.
const post = vi.fn();
vi.mock('@/services/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api-client')>();
  return {
    ...actual,
    apiClient: { post: (...a: unknown[]) => post(...a) },
  };
});

import { ApiError } from '@/services/api-client';
import { paymentsTransport } from './payments-service';

const input = { orderId: 'ord_123', provider: 'payme' as const, returnUrl: 'mator://payment-return' };

beforeEach(() => {
  post.mockReset();
});

describe('HttpPaymentsTransport — startPayment', () => {
  test('posts to /v1/payments/:provider/invoices with order_id + return_url', async () => {
    post.mockResolvedValueOnce({ payment_id: 'pay_1', deep_link: 'https://checkout.paycom.uz/abc' });
    await paymentsTransport.startPayment(input);
    expect(post.mock.calls[0]![0]).toBe('/v1/payments/payme/invoices');
    expect(post.mock.calls[0]![1]).toEqual({ order_id: 'ord_123', return_url: 'mator://payment-return' });
  });

  test('routes click to /v1/payments/click/invoices', async () => {
    post.mockResolvedValueOnce({ payment_id: 'pay_2', deep_link: 'click://services/pay?x=1' });
    await paymentsTransport.startPayment({ ...input, provider: 'click' });
    expect(post.mock.calls[0]![0]).toBe('/v1/payments/click/invoices');
  });

  test('prefers deep_link → ready (carries paymentId)', async () => {
    post.mockResolvedValueOnce({
      payment_id: 'pay_1',
      deep_link: 'https://checkout.paycom.uz/abc',
      https_fallback: 'https://checkout.paycom.uz/abc',
    });
    expect(await paymentsTransport.startPayment(input)).toEqual({
      status: 'ready',
      checkoutUrl: 'https://checkout.paycom.uz/abc',
      paymentId: 'pay_1',
    });
  });

  test('falls back to https_fallback when no deep_link', async () => {
    post.mockResolvedValueOnce({ payment_id: 'pay_1', https_fallback: 'https://checkout.paycom.uz/xyz' });
    expect(await paymentsTransport.startPayment(input)).toEqual({
      status: 'ready',
      checkoutUrl: 'https://checkout.paycom.uz/xyz',
      paymentId: 'pay_1',
    });
  });

  test('tolerates a legacy checkout_url field → ready', async () => {
    post.mockResolvedValueOnce({ checkout_url: 'https://checkout.paycom.uz/legacy' });
    expect(await paymentsTransport.startPayment(input)).toEqual({
      status: 'ready',
      checkoutUrl: 'https://checkout.paycom.uz/legacy',
      paymentId: undefined,
    });
  });

  test('2xx with no url → unsupported (never opens a dead tab)', async () => {
    post.mockResolvedValueOnce({});
    expect(await paymentsTransport.startPayment(input)).toEqual({ status: 'unsupported' });
  });

  test('404 (endpoint not live) → unsupported (fail open)', async () => {
    post.mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'no route'));
    expect(await paymentsTransport.startPayment(input)).toEqual({ status: 'unsupported' });
  });

  test('501 (not implemented) → unsupported (fail open)', async () => {
    post.mockRejectedValueOnce(new ApiError(501, 'NOT_IMPLEMENTED', 'todo'));
    expect(await paymentsTransport.startPayment(input)).toEqual({ status: 'unsupported' });
  });

  test('400 (order not chargeable online, e.g. fiscal data) → unsupported (fail open)', async () => {
    post.mockRejectedValueOnce(new ApiError(400, 'BAD_REQUEST', 'not fiscalizable'));
    expect(await paymentsTransport.startPayment(input)).toEqual({ status: 'unsupported' });
  });

  test('network/5xx error → throws (caller tells the buyer)', async () => {
    post.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
    await expect(paymentsTransport.startPayment(input)).rejects.toThrow();
    post.mockRejectedValueOnce(new ApiError(500, 'HTTP_500', 'boom'));
    await expect(paymentsTransport.startPayment(input)).rejects.toThrow();
  });
});
