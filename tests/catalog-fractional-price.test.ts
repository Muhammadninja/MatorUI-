/** Mapper regression only: synthetic part, no HTTP or account access. */
import { beforeEach, expect, test, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => true }));
vi.mock('@/services/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => get(...args) },
  ApiError: class extends Error {},
}));

import { fetchCatalogList } from '@/services/catalog-service';

const part = { id: 'p1', title: 'Oil', status: 'in_stock', images: [] };

async function priceOf(fields: Record<string, unknown>) {
  get.mockResolvedValue({ items: [{ ...part, ...fields }], total: 1, page: 1, page_size: 20 });
  const list = await fetchCatalogList({ page: 1, pageSize: 20 } as never);
  return list.items[0];
}

beforeEach(() => get.mockReset());

test('a fractional price shows the amount charged, not the rounded label', async () => {
  const item = await priceOf({ price_uzs: 65730.24, price_label: 'UZS 65 730' });
  expect(item.price).toBe('UZS 65 730.24');
  expect(item.priceUzs).toBe(65730.24);
});

test('a whole price keeps the backend label', async () => {
  const item = await priceOf({ price_uzs: 38661, price_label: 'UZS 38 661' });
  expect(item.price).toBe('UZS 38 661');
});
