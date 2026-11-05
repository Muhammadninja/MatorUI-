import { afterEach, describe, expect, test, vi } from 'vitest';
import { asUzs, toTiyin } from '@/types/money';
import { computeSubtotal, computeTotals, parsePrice } from './cart-math';

vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => false }));
vi.mock('@/services/api-client', () => ({ apiClient: {} }));
vi.mock('@/services/catalog-service', () => ({
  getCatalogMockItems: () =>
    [999, 1000, 10000, 10001].map((amount) => ({
      id: String(amount),
      title: 'Part',
      description: '',
      category: 'parts',
      price: `UZS ${amount.toLocaleString('en-US')}`,
      priceLabel: '',
    })),
}));
import { MockSearchTransport } from './search-service';

afterEach(() => vi.useRealTimers());
describe('UZS stays in whole som across search, cart and payment', () => {
  test.each([
    ['under_1k', ['999']],
    ['1k_to_10k', ['1000', '10000']],
    ['over_10k', ['10001']],
  ] as const)('mock %s boundaries match the displayed UZS bands', async (price, ids) => {
    vi.useFakeTimers();
    const pending = new MockSearchTransport().search({
      query: 'Part',
      limit: 50,
      filters: { categories: [], price, minRating: 'any' },
    });
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.results.map((r) => r.id).sort()).toEqual([...ids].sort());
  });
  test('369,000 UZS × 2 reaches checkout as 738,000 UZS, Payme alone uses tiyin', () => {
    expect(parsePrice('UZS 369 000')).toBe(369000);
    const subtotal = computeSubtotal([{ price: 'UZS 369 000', quantity: 2 }]);
    expect(subtotal).toBe(738000);
    const total = computeTotals(subtotal, null).total;
    expect(total).toBe(738000);
    expect(toTiyin(asUzs(total))).toBe(73800000);
  });
});
