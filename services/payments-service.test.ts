/**
 * payments-service — HTTP transport contract tests.
 *
 * Pins the Payme start-payment wire contract (POST /v1/orders/:id/payment) and
 * the FAIL-OPEN behavior: a not-live endpoint (404/501) must degrade to
 * `unsupported` so a placed order still completes, while a real transport error
 * (network/5xx) must surface so the caller can tell the buyer payment couldn't
 * start.
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
  test('posts to /v1/orders/:id/payment with provider + return_url', async () => {
    post.mockResolvedValueOnce({ checkout_url: 'https://checkout.paycom.uz/abc' });
    await paymentsTransport.startPayment(input);
    expect(post.mock.calls[0]![0]).toBe('/v1/orders/ord_123/payment');
    expect(post.mock.calls[0]![1]).toEqual({ provider: 'payme', return_url: 'mator://payment-return' });
  });

  test('maps checkout_url (snake) → ready', async () => {
    post.mockResolvedValueOnce({ checkout_url: 'https://checkout.paycom.uz/abc' });
    expect(await paymentsTransport.startPayment(input)).toEqual({
      status: 'ready',
      checkoutUrl: 'https://checkout.paycom.uz/abc',
    });
  });

  test('maps checkoutUrl (camel) → ready', async () => {
    post.mockResolvedValueOnce({ checkoutUrl: 'https://checkout.paycom.uz/xyz' });
    expect(await paymentsTransport.startPayment(input)).toEqual({
      status: 'ready',
      checkoutUrl: 'https://checkout.paycom.uz/xyz',
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

  test('network/5xx error → throws (caller tells the buyer)', async () => {
    post.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
    await expect(paymentsTransport.startPayment(input)).rejects.toThrow();
    post.mockRejectedValueOnce(new ApiError(500, 'HTTP_500', 'boom'));
    await expect(paymentsTransport.startPayment(input)).rejects.toThrow();
  });
});
