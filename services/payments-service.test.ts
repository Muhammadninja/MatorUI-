/**
 * payments-service — HTTP transport contract tests.
 *
 * Pins the LIVE invoice wire contract (POST /v1/payments/:provider/invoices →
 * { deep_link, https_fallback, payment_id }) and that nothing here fails open: a
 * refusal of any kind surfaces with its code, so an order the backend would not
 * charge can never be taken for one that needs no payment.
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

  test('2xx with no url is a failure: there is nothing to pay with', async () => {
    post.mockResolvedValueOnce({});
    await expect(paymentsTransport.startPayment(input)).rejects.toMatchObject({
      code: 'PAYMENT_LINK_MISSING',
    });
  });

  test.each([
    [400, 'FISCAL_DATA_INCOMPLETE'],
    [409, 'PART_UNAVAILABLE'],
    [400, 'BAD_REQUEST'],
    [404, 'NOT_FOUND'],
    [501, 'NOT_IMPLEMENTED'],
  ])('a %i %s surfaces with its code, never as "nothing to pay"', async (status, code) => {
    post.mockRejectedValueOnce(new ApiError(status, code, 'refused'));
    await expect(paymentsTransport.startPayment(input)).rejects.toMatchObject({ code });
  });

  test('network/5xx error → throws (caller tells the buyer)', async () => {
    post.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
    await expect(paymentsTransport.startPayment(input)).rejects.toThrow();
    post.mockRejectedValueOnce(new ApiError(500, 'HTTP_500', 'boom'));
    await expect(paymentsTransport.startPayment(input)).rejects.toThrow();
  });
});
