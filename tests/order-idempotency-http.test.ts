import { afterEach, expect, test, vi } from 'vitest';
vi.mock('@/config/api', () => ({ getApiBaseUrl: () => 'https://unit.invalid',
  getAuthToken: async () => null, shouldUseHttpTransport: () => true }));
import { HttpOrdersTransport } from '@/services/orders-api';
import type { CreateOrderInput } from '@/services/orders-service';

afterEach(() => vi.unstubAllGlobals());

const input: CreateOrderInput = { items: [{ productId: 'part_1', quantity: 1 }], addressId: null,
  paymentType: 'cash', shippingOptionKey: 'pickup', promoCode: null };
const created = () => new Response(
  JSON.stringify({ order_id: 'ord_1', status: 'pending_payment', total_uzs: 1000, created_at: '2026-11-12T00:00:00Z' }),
  { status: 201 },
);
const headerOf = (init: RequestInit | undefined) => (init?.headers as Record<string, string>)['Idempotency-Key'];

test('the key travels as a header and never in the whitelisted body', async () => {
  const fetch = vi.fn().mockResolvedValue(created());
  vi.stubGlobal('fetch', fetch);
  await new HttpOrdersTransport().createOrder({ ...input, idempotencyKey: 'ord_unit_key_1' });

  const [, init] = fetch.mock.calls[0]!;
  expect(headerOf(init)).toBe('ord_unit_key_1');
  const body = JSON.parse(init.body as string);
  expect(body).not.toHaveProperty('idempotencyKey');
  expect(body).not.toHaveProperty('idempotency_key');
});

test('a dropped connection is not resent by the client: the buyer retries under the same key', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Network request failed'));
  vi.stubGlobal('fetch', fetch);
  await expect(new HttpOrdersTransport().createOrder({ ...input, idempotencyKey: 'ord_unit_key_2' }))
    .rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  // A write is never replayed by the transport; useCreateOrder keeps the key for the retry.
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(headerOf(fetch.mock.calls[0]![1])).toBe('ord_unit_key_2');
});

test('an older caller without a key sends no header', async () => {
  const fetch = vi.fn().mockResolvedValue(created());
  vi.stubGlobal('fetch', fetch);
  await new HttpOrdersTransport().createOrder(input);
  expect(headerOf(fetch.mock.calls[0]![1])).toBeUndefined();
});
