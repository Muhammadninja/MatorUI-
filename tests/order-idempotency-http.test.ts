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

test('a resend of the request after a dropped connection carries the same key', async () => {
  const fetch = vi.fn()
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce(created());
  vi.stubGlobal('fetch', fetch);
  const result = await new HttpOrdersTransport().createOrder({ ...input, idempotencyKey: 'ord_unit_key_2' });

  expect(result.orderId).toBe('ord_1');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.map(([, init]) => headerOf(init))).toEqual(['ord_unit_key_2', 'ord_unit_key_2']);
});

test('an older caller without a key sends no header', async () => {
  const fetch = vi.fn().mockResolvedValue(created());
  vi.stubGlobal('fetch', fetch);
  await new HttpOrdersTransport().createOrder(input);
  expect(headerOf(fetch.mock.calls[0]![1])).toBeUndefined();
});
