import { describe, expect, test } from 'vitest';

import {
  computeSubtotal,
  computeTotals,
  evaluatePromoCode,
  FLAT_SHIPPING,
  formatCurrency,
  FREE_SHIPPING_THRESHOLD,
  parsePrice,
  PROMO_CODES,
  PROMO_MIN_SUBTOTAL,
  round,
  TAX_RATE,
  type PromoCode,
} from './cart-math';

const SUBTOTAL_BELOW_FREE = 200; // shipping = FLAT_SHIPPING
const SUBTOTAL_AT_FREE = FREE_SHIPPING_THRESHOLD; // shipping = 0
const SUBTOTAL_ABOVE_FREE = FREE_SHIPPING_THRESHOLD + 100; // shipping = 0

const expectedTax = (base: number) => round(base * TAX_RATE);
const expectedTotal = (base: number, shipping: number) =>
  round(base + shipping + expectedTax(base));

describe('parsePrice', () => {
  test('strips currency formatting', () => {
    expect(parsePrice('$1,240.50')).toBe(1240.5);
    expect(parsePrice('$199')).toBe(199);
  });

  test('extracts a leading number from mixed strings', () => {
    expect(parsePrice('USD 75.99 each')).toBe(75.99);
  });

  test('returns 0 for inputs with no digits', () => {
    expect(parsePrice('--')).toBe(0);
    expect(parsePrice('')).toBe(0);
    expect(parsePrice('free')).toBe(0);
  });
});

describe('round', () => {
  test('rounds to 2 decimal places', () => {
    expect(round(1.234)).toBe(1.23);
    expect(round(1.235)).toBe(1.24);
    expect(round(0)).toBe(0);
    expect(round(123.456789)).toBe(123.46);
  });

  test('documents the IEEE-754 quirk: 1.005 rounds DOWN, not up', () => {
    // 1.005 * 100 === 100.49999999999999 in JS, so Math.round drops to 100
    // → 1.00, not 1.01. This is acceptable for cart math (sub-cent only on
    // inputs that don't occur in practice). If we ever need true mathematical
    // rounding, switch round() to a banker's-rounding or string-based impl.
    expect(round(1.005)).toBe(1.0);
  });
});

describe('formatCurrency', () => {
  test('formats as UZS whole som with thousands separators', () => {
    expect(formatCurrency(0)).toBe('UZS 0');
    expect(formatCurrency(1240.5)).toBe('UZS 1,241');
    expect(formatCurrency(1234567.8)).toBe('UZS 1,234,568');
  });
});

describe('computeSubtotal', () => {
  test('multiplies price by quantity and sums across items', () => {
    expect(
      computeSubtotal([
        { price: '$10.00', quantity: 2 },
        { price: '$25.50', quantity: 4 },
      ]),
    ).toBe(2 * 10 + 4 * 25.5);
  });

  test('returns 0 for an empty cart', () => {
    expect(computeSubtotal([])).toBe(0);
  });

  test('ignores unparseable price strings (treats them as 0)', () => {
    expect(
      computeSubtotal([
        { price: 'invalid', quantity: 3 },
        { price: '$5', quantity: 1 },
      ]),
    ).toBe(5);
  });
});

describe('computeTotals — no promo', () => {
  test('empty cart yields all zeros', () => {
    expect(computeTotals(0, null)).toEqual({
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
    });
  });

  test('charges flat shipping below the free-ship threshold', () => {
    const totals = computeTotals(SUBTOTAL_BELOW_FREE, null);
    expect(totals.subtotal).toBe(SUBTOTAL_BELOW_FREE);
    expect(totals.discount).toBe(0);
    expect(totals.shipping).toBe(FLAT_SHIPPING);
    expect(totals.tax).toBe(expectedTax(SUBTOTAL_BELOW_FREE));
    expect(totals.total).toBe(expectedTotal(SUBTOTAL_BELOW_FREE, FLAT_SHIPPING));
  });

  test('waives shipping AT the free-ship threshold', () => {
    const totals = computeTotals(SUBTOTAL_AT_FREE, null);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(expectedTotal(SUBTOTAL_AT_FREE, 0));
  });

  test('waives shipping ABOVE the free-ship threshold', () => {
    const totals = computeTotals(SUBTOTAL_ABOVE_FREE, null);
    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(expectedTotal(SUBTOTAL_ABOVE_FREE, 0));
  });
});

describe('computeTotals — percent promo (WELCOME10)', () => {
  const promo = PROMO_CODES.WELCOME10;

  test('applies 10% off and recomputes tax on the discounted base', () => {
    const totals = computeTotals(SUBTOTAL_BELOW_FREE, promo);
    const expectedDiscount = round(SUBTOTAL_BELOW_FREE * 0.1);
    const taxedBase = SUBTOTAL_BELOW_FREE - expectedDiscount;
    expect(totals.discount).toBe(expectedDiscount);
    expect(totals.tax).toBe(expectedTax(taxedBase));
    expect(totals.total).toBe(expectedTotal(taxedBase, FLAT_SHIPPING));
  });

  test('no-op on empty cart', () => {
    expect(computeTotals(0, promo)).toEqual({
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
    });
  });
});

describe('computeTotals — capped percent promo (RIDE25, max $200)', () => {
  const promo = PROMO_CODES.RIDE25;

  test('caps the discount at maxDiscount when raw percent would exceed it', () => {
    // 25% of $1,000 = $250 → clamped to $200
    const totals = computeTotals(1000, promo);
    expect(totals.discount).toBe(200);
    const taxedBase = 1000 - 200;
    expect(totals.tax).toBe(expectedTax(taxedBase));
    expect(totals.total).toBe(expectedTotal(taxedBase, 0)); // above free-ship
  });

  test('does NOT cap when raw percent is below the cap', () => {
    // 25% of $400 = $100 → below the $200 cap, applied as-is
    const totals = computeTotals(400, promo);
    expect(totals.discount).toBe(100);
  });
});

describe('computeTotals — free_shipping promo (FREESHIP)', () => {
  const promo = PROMO_CODES.FREESHIP;

  test('zeros shipping but leaves discount at 0', () => {
    const totals = computeTotals(SUBTOTAL_BELOW_FREE, promo);
    expect(totals.discount).toBe(0);
    expect(totals.shipping).toBe(0);
    expect(totals.tax).toBe(expectedTax(SUBTOTAL_BELOW_FREE));
    expect(totals.total).toBe(expectedTotal(SUBTOTAL_BELOW_FREE, 0));
  });

  test('is a no-op when shipping was already free (above threshold)', () => {
    const withPromo = computeTotals(SUBTOTAL_ABOVE_FREE, promo);
    const withoutPromo = computeTotals(SUBTOTAL_ABOVE_FREE, null);
    expect(withPromo).toEqual(withoutPromo);
  });
});

describe('computeTotals — fixed promo (synthetic)', () => {
  const promo: PromoCode = {
    code: 'TEST50',
    label: '$50 off',
    kind: 'fixed',
    value: 50,
  };

  test('subtracts the fixed amount', () => {
    const totals = computeTotals(200, promo);
    expect(totals.discount).toBe(50);
    const taxedBase = 150;
    expect(totals.tax).toBe(expectedTax(taxedBase));
    expect(totals.total).toBe(expectedTotal(taxedBase, FLAT_SHIPPING));
  });

  test('does not let discount exceed subtotal', () => {
    // Promo value > subtotal: discount caps at subtotal, so net taxed base is 0.
    const totals = computeTotals(30, promo);
    expect(totals.discount).toBe(30);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(FLAT_SHIPPING);
  });
});

describe('evaluatePromoCode', () => {
  test('recognizes known codes in any case', () => {
    expect(evaluatePromoCode('welcome10', 200)).toEqual({
      ok: true,
      promo: PROMO_CODES.WELCOME10,
    });
    expect(evaluatePromoCode('  WELCOME10  ', 200)).toEqual({
      ok: true,
      promo: PROMO_CODES.WELCOME10,
    });
  });

  test('rejects unknown codes', () => {
    expect(evaluatePromoCode('NOPE', 500)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  test('rejects when subtotal is below the minimum', () => {
    expect(evaluatePromoCode('WELCOME10', PROMO_MIN_SUBTOTAL - 1)).toEqual({
      ok: false,
      reason: 'min_subtotal',
      minSubtotal: PROMO_MIN_SUBTOTAL,
    });
  });

  test('accepts when subtotal is exactly at the minimum', () => {
    const result = evaluatePromoCode('WELCOME10', PROMO_MIN_SUBTOTAL);
    expect(result.ok).toBe(true);
  });
});

describe('rounding behavior — totals never produce >2-decimal noise', () => {
  test('floating-point edge case: WELCOME10 on $19,640', () => {
    // This is the exact value from the verify run; locks in the answer.
    const totals = computeTotals(19640, PROMO_CODES.WELCOME10);
    expect(totals.subtotal).toBe(19640);
    expect(totals.discount).toBe(1964);
    expect(totals.shipping).toBe(0);
    expect(totals.tax).toBe(1502.46); // (19640-1964) * 0.085 = 1502.46
    expect(totals.total).toBe(19178.46); // 17676 + 0 + 1502.46
  });

  test('RIDE25 cap on $19,640 → $200 off, tax on $19,440', () => {
    const totals = computeTotals(19640, PROMO_CODES.RIDE25);
    expect(totals.discount).toBe(200);
    expect(totals.tax).toBe(1652.4); // 19440 * 0.085
    expect(totals.total).toBe(21092.4); // 19440 + 0 + 1652.40
  });
});
