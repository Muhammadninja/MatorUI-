import { afterEach, expect, test, vi } from 'vitest';
vi.mock('@/config/api', () => ({ getApiBaseUrl: () => 'https://unit.invalid',
  getAuthToken: async () => null, shouldUseHttpTransport: () => true }));
import { HttpOrdersTransport } from '@/services/orders-api';

afterEach(() => vi.unstubAllGlobals());
test('a lost POST order response causes one network attempt, without automatic resubmission', async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError('response lost after server commit'));
  vi.stubGlobal('fetch', fetch);
  await expect(new HttpOrdersTransport().createOrder({ items: [{ productId: 'unit-part', quantity: 1 }],
    addressId: null, paymentType: 'cash', shippingOptionKey: 'pickup', promoCode: null }))
    .rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('the order idempotency key is sent as a header, never in the whitelisted body', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ order_id: 'unit-order', status: 'pending_payment' }), { status: 201 }));
  vi.stubGlobal('fetch', fetch);
  await new HttpOrdersTransport().createOrder({ items: [{ productId: 'unit-part', quantity: 1 }],
    addressId: null, paymentType: 'cash', shippingOptionKey: 'pickup', promoCode: null, idempotencyKey: 'ord_unit_key' });
  const [, init] = fetch.mock.calls[0];
  expect(init.headers['Idempotency-Key']).toBe('ord_unit_key');
  expect(JSON.parse(init.body)).not.toHaveProperty('idempotencyKey');
  expect(JSON.parse(init.body)).not.toHaveProperty('idempotency_key');
});
