/** Pure unit checks with synthetic amounts; no API/account/order requests. */
import { describe, expect, test } from 'vitest';

import { confirmedMoney, formatOrderMoney, getOrderPricing, type OrderPricingInput } from './order-pricing';

const complete = (): OrderPricingInput => ({
  currency: 'UZS', subtotal_uzs: 100000, delivery_uzs: 25000,
  service_fee_uzs: 5000, discount_uzs: 0, total_uzs: 130000,
  items: [{ qty: 1, price_uzs: 100000, line_total_uzs: 100000 }],
});

test('complete confirmed amounts reconcile the existing 100k + 25k + 5k order shape', () => {
  const pricing = getOrderPricing(complete());
  expect(pricing).toEqual({
    subtotal: 100000, delivery: 25000, serviceFee: 5000, discount: 0, total: 130000,
    lines: [{ quantity: 1, unitPrice: 100000, lineTotal: 100000 }],
    checks: { totals: true, items: true, units: [true] }, status: 'confirmed',
  });
});

test('quantity greater than one retains distinct confirmed unit and line prices', () => {
  const pricing = getOrderPricing({ ...complete(), items: [{ qty: 4, price_uzs: 25000, line_total_uzs: 100000 }] });
  expect(pricing.lines[0]).toEqual({ quantity: 4, unitPrice: 25000, lineTotal: 100000 });
  expect(pricing.checks.units).toEqual([true]);
  expect(pricing.status).toBe('confirmed');
});

test('discount is subtracted once while explicit zero fees stay known', () => {
  const pricing = getOrderPricing({ ...complete(), delivery_uzs: 0, service_fee_uzs: 0, discount_uzs: 15000, total_uzs: 85000 });
  expect(pricing).toMatchObject({ delivery: 0, serviceFee: 0, discount: 15000, total: 85000, status: 'confirmed' });
});

test.each([undefined, null])('missing or null fee stays unknown and is never inferred from the grand total (%s)', (delivery) => {
  const pricing = getOrderPricing({ ...complete(), delivery_uzs: delivery });
  expect(pricing.delivery).toBeNull();
  expect(pricing.total).toBe(130000);
  expect(pricing.checks.totals).toBeNull();
  expect(pricing.status).toBe('incomplete');
});

test.each(['subtotal_uzs', 'delivery_uzs', 'service_fee_uzs', 'discount_uzs', 'total_uzs'] as const)(
  'missing %s does not become zero', (field) => {
    const pricing = getOrderPricing({ ...complete(), [field]: null });
    const mapped = { subtotal_uzs: 'subtotal', delivery_uzs: 'delivery', service_fee_uzs: 'serviceFee', discount_uzs: 'discount', total_uzs: 'total' } as const;
    expect(pricing[mapped[field]]).toBeNull();
    expect(pricing.checks.totals).toBeNull();
    expect(pricing.status).toBe('incomplete');
  },
);

test('total mismatch preserves server amounts without relabeling the difference as delivery', () => {
  const pricing = getOrderPricing({ ...complete(), total_uzs: 140000 });
  expect(pricing.total).toBe(140000);
  expect(pricing.delivery).toBe(25000);
  expect(pricing.checks).toEqual({ totals: false, items: true, units: [true] });
  expect(pricing.status).toBe('inconsistent');
});

test('server line totals disagreeing with subtotal are flagged independently of total arithmetic', () => {
  const pricing = getOrderPricing({ ...complete(), items: [{ qty: 2, price_uzs: 100000, line_total_uzs: 200000 }] });
  expect(pricing.subtotal).toBe(100000);
  expect(pricing.lines[0].lineTotal).toBe(200000);
  expect(pricing.checks).toEqual({ totals: true, items: false, units: [true] });
  expect(pricing.status).toBe('inconsistent');
});

test('unit-times-quantity disagreement preserves the confirmed line total and flags inconsistency', () => {
  const pricing = getOrderPricing({ ...complete(), items: [{ qty: 2, price_uzs: 100000, line_total_uzs: 100000 }] });
  expect(pricing.lines[0]).toEqual({ quantity: 2, unitPrice: 100000, lineTotal: 100000 });
  expect(pricing.checks).toEqual({ totals: true, items: true, units: [false] });
  expect(pricing.status).toBe('inconsistent');
});

test('missing line total is never inferred even when unit price and quantity are known', () => {
  const pricing = getOrderPricing({ ...complete(), items: [{ qty: 2, price_uzs: 50000 }] });
  expect(pricing.lines[0]).toEqual({ quantity: 2, unitPrice: 50000, lineTotal: null });
  expect(pricing.checks).toEqual({ totals: true, items: null, units: [null] });
  expect(pricing.status).toBe('incomplete');
});

test('missing unit price does not erase a confirmed line total or invent a unit value', () => {
  const pricing = getOrderPricing({ ...complete(), items: [{ qty: 2, line_total_uzs: 100000 }] });
  expect(pricing.lines[0]).toEqual({ quantity: 2, unitPrice: null, lineTotal: 100000 });
  expect(pricing.checks).toEqual({ totals: true, items: true, units: [null] });
  expect(pricing.status).toBe('incomplete');
});

test.each([undefined, null])('missing item data leaves the item check unknown (%s)', (items) => {
  const pricing = getOrderPricing({ ...complete(), items });
  expect(pricing.lines).toEqual([]);
  expect(pricing.checks.items).toBeNull();
  expect(pricing.status).toBe('incomplete');
});

describe('strict monetary validation', () => {
  test.each(['100000', '', null, undefined, -1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, 0.001])(
    'rejects invalid or unsafe amount %s without coercion', (value) => {
      expect(confirmedMoney(value)).toBeNull();
      expect(getOrderPricing({ ...complete(), total_uzs: value }).total).toBeNull();
    },
  );
  test('explicit zero is confirmed and formatted independently of missing values', () => {
    expect(confirmedMoney(0)).toBe(0);
    expect(formatOrderMoney(0)).toBe("0 UZS");
    expect(formatOrderMoney(null)).toBe('');
    expect(formatOrderMoney(undefined)).toBe('');
    expect(formatOrderMoney(NaN)).toBe('');
    expect(formatOrderMoney(-1)).toBe('');
  });
});

test.each([undefined, null, '2', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'invalid quantity %s does not silently become one', (qty) => {
    const pricing = getOrderPricing({ ...complete(), items: [{ qty, price_uzs: 100000, line_total_uzs: 100000 }] });
    expect(pricing.lines[0].quantity).toBeNull();
    expect(pricing.checks.units).toEqual([null]);
    expect(pricing.status).toBe('incomplete');
  },
);

test('foreign currency cannot be presented as UZS', () => {
  const pricing = getOrderPricing({ ...complete(), currency: 'USD' });
  expect(pricing).toMatchObject({ subtotal: null, delivery: null, serviceFee: null, discount: null, total: null, status: 'incomplete' });
  expect(pricing.lines[0]).toEqual({ quantity: 1, unitPrice: null, lineTotal: null });
});

test.each([undefined, null])('explicit *_uzs fields remain supported without currency (%s)', (currency) => {
  expect(getOrderPricing({ ...complete(), currency }).status).toBe('confirmed');
});

test('cent precision reconciles totals and quantities without floating-point equality failures', () => {
  const pricing = getOrderPricing({
    currency: 'UZS', subtotal_uzs: 3.3, delivery_uzs: 0.1, service_fee_uzs: 0.2,
    discount_uzs: 0.3, total_uzs: 3.3,
    items: [{ qty: 3, price_uzs: 1.1, line_total_uzs: 3.3 }],
  });
  expect(pricing.status).toBe('confirmed');
  expect(confirmedMoney(0.3)).toBe(0.3);
  // Inputs are server-confirmed decimals; client-computed sub-cent values are not accepted.
  expect(confirmedMoney(0.1 + 0.2)).toBeNull();
  expect(formatOrderMoney(12345.6)).toBe("12\u00A0345.60 UZS");
});

test('unsafe intermediate totals remain unknown rather than passing rounded arithmetic', () => {
  const large = 40000000000000;
  const pricing = getOrderPricing({
    subtotal_uzs: large, delivery_uzs: large, service_fee_uzs: large, discount_uzs: 0, total_uzs: 0,
    items: [{ qty: 1, price_uzs: large, line_total_uzs: large }],
  });
  expect(pricing.checks.totals).toBeNull();
  expect(pricing.status).toBe('incomplete');
});

test('unsafe intermediate item sums and unit products remain unknown', () => {
  const large = 40000000000000;
  const summed = getOrderPricing({
    subtotal_uzs: 0, delivery_uzs: 0, service_fee_uzs: 0, discount_uzs: 0, total_uzs: 0,
    items: Array.from({ length: 3 }, () => ({ qty: 1, price_uzs: large, line_total_uzs: large })),
  });
  expect(summed.checks.items).toBeNull();
  expect(summed.status).toBe('incomplete');
  const multiplied = getOrderPricing({ ...complete(), subtotal_uzs: large, total_uzs: large + 30000, items: [{ qty: 3, price_uzs: large, line_total_uzs: large }] });
  expect(multiplied.checks.units).toEqual([null]);
  expect(multiplied.status).toBe('incomplete');
});

test('normalization does not mutate or add values to a frozen input', () => {
  const line = Object.freeze({ qty: 2, price_uzs: 50000 });
  const raw = Object.freeze({ ...complete(), delivery_uzs: null, items: Object.freeze([line]) });
  const original = JSON.stringify(raw);
  const pricing = getOrderPricing(raw);
  expect(pricing.delivery).toBeNull();
  expect(pricing.lines[0].lineTotal).toBeNull();
  expect(JSON.stringify(raw)).toBe(original);
});

test('overflow before a discount cannot lose a cent and falsely confirm a safe final total', () => {
  const pricing = getOrderPricing({
    currency: 'UZS', subtotal_uzs: 40000000000000.01, delivery_uzs: 40000000000000,
    service_fee_uzs: 40000000000000, discount_uzs: 40000000000000, total_uzs: 80000000000000,
    items: [{ qty: 1, price_uzs: 40000000000000.01, line_total_uzs: 40000000000000.01 }],
  });
  expect(pricing.checks.totals).toBeNull();
  expect(pricing.status).toBe('incomplete');
  expect(pricing.total).toBe(80000000000000);
});
