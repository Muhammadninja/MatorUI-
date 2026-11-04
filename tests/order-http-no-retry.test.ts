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
