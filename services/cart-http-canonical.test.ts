import { beforeEach, expect, test, vi } from 'vitest';
import { computeSubtotal } from './cart-math';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => true }));
vi.mock('@/services/api-client', () => ({ apiClient: api }));
import { HttpCartTransport } from './cart-api';

const wireLine = {
  id: 'item_1', part_id: 'part_stock_2839', title: 'Filter',
  price: 'UZS 21 506', price_uzs: 21505.57, quantity: 3,
};
beforeEach(() => { vi.resetAllMocks(); });

test('numeric fractional UZS is authoritative over the rounded display label', async () => {
  api.get.mockResolvedValue({ items: [wireLine] });
  const snapshot = await new HttpCartTransport().fetch();
  expect(snapshot.items[0].price).toBe('UZS 21505.57');
  expect(computeSubtotal(snapshot.items)).toBeCloseTo(64516.71);
});

test('label remains a fallback when the server has no numeric price', async () => {
  api.get.mockResolvedValue({ items: [{ ...wireLine, price_uzs: undefined }] });
  expect((await new HttpCartTransport().fetch()).items[0].price).toBe('UZS 21 506');
});

test('numeric zero is retained and never replaced with a stale nonzero label', async () => {
  api.get.mockResolvedValue({ items: [{ ...wireLine, price_uzs: 0 }] });
  const snapshot = await new HttpCartTransport().fetch();
  expect(computeSubtotal(snapshot.items)).toBe(0);
});

test('a mutation returns the exact repriced server line', async () => {
  api.post.mockResolvedValue({ items: [wireLine] });
  const line = await new HttpCartTransport().addItem({ productId: wireLine.part_id, title: 'Old', description: '', price: 'UZS 1' });
  expect(line.price).toBe('UZS 21505.57');
  expect(line.quantity).toBe(3);
});

test('a previous session response cannot overwrite the current line id map', async () => {
  let resolve!: (value: unknown) => void;
  api.get.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const transport = new HttpCartTransport();
  transport.setSession('a');
  const old = transport.fetch().catch((error) => error);
  transport.setSession('b');
  api.get.mockResolvedValueOnce({ items: [{ ...wireLine, id: 'line_b' }] });
  await transport.fetch();
  resolve({ items: [wireLine] });
  expect((await old).name).toBe('AbortError');
  api.patch.mockResolvedValue({ items: [{ ...wireLine, id: 'line_b' }] });
  await transport.updateQuantity(wireLine.part_id, 4);
  expect(api.patch).toHaveBeenCalledWith('/v1/cart/items/line_b', { quantity: 4 });
});

test('a cold-map update cannot recreate a line after its session changes', async () => {
  let resolve!: (value: unknown) => void;
  api.get.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const transport = new HttpCartTransport();
  transport.setSession('a');
  const update = transport.updateQuantity('missing', 2).catch((error) => error);
  transport.setSession(null);
  resolve({ items: [] });
  expect((await update).name).toBe('AbortError');
  expect(api.post).not.toHaveBeenCalled();
});
