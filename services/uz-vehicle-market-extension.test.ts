import { describe, expect, test } from 'vitest';

import { UZ_BRANDS, UZ_ENGINES, UZ_MODELS } from '@/services/uz-vehicle-catalog';
import { UZ_MARKET_EXTRA_BRANDS, UZ_MARKET_EXTRA_MODELS } from '@/services/uz-vehicle-market-extension';

describe('bundled catalog market extension', () => {
  test('brand and model ids stay unique after the merge', () => {
    expect(new Set(UZ_BRANDS.map((b) => b.id)).size).toBe(UZ_BRANDS.length);
    expect(new Set(UZ_MODELS.map((m) => m.id)).size).toBe(UZ_MODELS.length);
  });

  test('every extra model belongs to a known brand', () => {
    const brands = new Set(UZ_BRANDS.map((b) => b.id));
    expect(UZ_MARKET_EXTRA_MODELS.filter((m) => !brands.has(m.brandId))).toEqual([]);
  });

  test('extras are appended, not replacing the core line-up', () => {
    expect(UZ_BRANDS.slice(-UZ_MARKET_EXTRA_BRANDS.length)).toEqual(UZ_MARKET_EXTRA_BRANDS);
    expect(UZ_MODELS.find((m) => m.id === 'cobalt')).toBeDefined();
    expect(UZ_ENGINES.find((e) => e.id === 'b15d2-na')).toBeDefined();
  });
});
