import { describe, expect, it } from 'vitest';

import { resolveItemPricing, resolveItemSale, type Sale } from '@/services/sales-service';

const sale = (over: Partial<Sale> & Pick<Sale, 'scopeType'>): Sale => ({
  id: 's1',
  title: 'Sale',
  discountType: 'PERCENT',
  discountValue: 15,
  targetIds: [],
  priority: 0,
  ...over,
});

describe('resolveItemSale', () => {
  const item = { id: 'p1', categoryId: 'brakes', sellerId: 'd1', priceUzs: 100_000 };

  it('returns null when there are no sales', () => {
    expect(resolveItemSale(item, [])).toBeNull();
  });

  it('matches an ALL_PRODUCTS sale and reports the percent', () => {
    const got = resolveItemSale(item, [sale({ scopeType: 'ALL_PRODUCTS', discountValue: 20 })]);
    expect(got?.percent).toBe(20);
  });

  it('matches PRODUCTS / CATEGORIES / DEALERS by the right id', () => {
    expect(resolveItemSale(item, [sale({ scopeType: 'PRODUCTS', targetIds: ['p1'] })])?.percent).toBe(15);
    expect(resolveItemSale(item, [sale({ scopeType: 'CATEGORIES', targetIds: ['brakes'] })])?.percent).toBe(15);
    expect(resolveItemSale(item, [sale({ scopeType: 'DEALERS', targetIds: ['d1'] })])?.percent).toBe(15);
  });

  it('does not match when the scoped id is absent from targetIds', () => {
    expect(resolveItemSale(item, [sale({ scopeType: 'PRODUCTS', targetIds: ['other'] })])).toBeNull();
    expect(resolveItemSale(item, [sale({ scopeType: 'CATEGORIES', targetIds: ['engine'] })])).toBeNull();
  });

  it('picks the highest-priority sale when several match', () => {
    const got = resolveItemSale(item, [
      sale({ id: 'low', scopeType: 'ALL_PRODUCTS', discountValue: 5, priority: 1 }),
      sale({ id: 'high', scopeType: 'PRODUCTS', targetIds: ['p1'], discountValue: 30, priority: 9 }),
    ]);
    expect(got?.sale.id).toBe('high');
    expect(got?.percent).toBe(30);
  });

  it('converts a FIXED discount to the equivalent percent of the pre-discount price', () => {
    // 25 000 off a 100 000 final price → original 125 000 → 20%.
    const got = resolveItemSale(item, [
      sale({ scopeType: 'ALL_PRODUCTS', discountType: 'FIXED', discountValue: 25_000 }),
    ]);
    expect(got?.percent).toBe(20);
  });

  it('drops a FIXED sale when the item has no numeric price', () => {
    const got = resolveItemSale(
      { id: 'p1', priceUzs: undefined },
      [sale({ scopeType: 'ALL_PRODUCTS', discountType: 'FIXED', discountValue: 25_000 })],
    );
    expect(got).toBeNull();
  });
});

describe('resolveItemPricing', () => {
  it('keeps a fractional struck-through price exact', () => {
    const { wasUzs } = resolveItemPricing(
      { id: 'p', priceUzs: 60000.5, originalPriceUzs: 65730.24, salePercent: 9 } as never,
      [],
    );
    expect(wasUzs).toBe(65730.24);
  });

  it('reads a fractional display price as its real amount when no number is given', () => {
    const { wasUzs } = resolveItemPricing(
      { id: 'p', price: 'UZS 100 000.50', salePercent: 50 } as never,
      [],
    );
    expect(wasUzs).toBe(200001);
  });
});
