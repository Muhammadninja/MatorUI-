import { describe, expect, test } from 'vitest';

import {
  computeSubtotal,
  computeTotals,
  evaluatePromoCode,
  formatCurrency,
  parsePrice,
  PROMO_CODES,
  PROMO_MIN_SUBTOTAL,
  round,
  SERVICE_FEE_UZS,
  STANDARD_DELIVERY_UZS,
  type PromoCode,
} from './cart-math';

const SUBTOTAL = 200;

const expectedTotal = (base: number, shipping: number) =>
  round(base + shipping + SERVICE_FEE_UZS);

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
    expect(formatCurrency(0)).toBe('0 UZS');
    expect(formatCurrency(1240.5)).toBe('1\u00A0241 UZS');
    expect(formatCurrency(1234567.8)).toBe('1\u00A0234\u00A0568 UZS');
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
      serviceFee: 0,
      total: 0,
    });
  });

  test('charges the flat delivery fee + service fee on any non-empty cart', () => {
    const totals = computeTotals(SUBTOTAL, null);
    expect(totals.subtotal).toBe(SUBTOTAL);
    expect(totals.discount).toBe(0);
    expect(totals.shipping).toBe(STANDARD_DELIVERY_UZS);
    expect(totals.serviceFee).toBe(SERVICE_FEE_UZS);
    expect(totals.total).toBe(expectedTotal(SUBTOTAL, STANDARD_DELIVERY_UZS));
  });

  test('the flat fees do not change with subtotal size (no free-shipping threshold)', () => {
    const small = computeTotals(SUBTOTAL, null);
    const large = computeTotals(SUBTOTAL * 1000, null);
    expect(large.shipping).toBe(small.shipping);
    expect(large.serviceFee).toBe(small.serviceFee);
  });
});

describe('computeTotals — percent promo (WELCOME10)', () => {
  const promo = PROMO_CODES.WELCOME10;

  test('applies 10% off the subtotal; shipping/service fee are untouched', () => {
    const totals = computeTotals(SUBTOTAL, promo);
    const expectedDiscount = round(SUBTOTAL * 0.1);
    expect(totals.discount).toBe(expectedDiscount);
    expect(totals.shipping).toBe(STANDARD_DELIVERY_UZS);
    expect(totals.serviceFee).toBe(SERVICE_FEE_UZS);
    expect(totals.total).toBe(
      round(SUBTOTAL - expectedDiscount + STANDARD_DELIVERY_UZS + SERVICE_FEE_UZS),
    );
  });

  test('no-op on empty cart', () => {
    expect(computeTotals(0, promo)).toEqual({
      subtotal: 0,
      discount: 0,
      shipping: 0,
      serviceFee: 0,
      total: 0,
    });
  });
});

describe('computeTotals — capped percent promo (RIDE25, max 200)', () => {
  const promo = PROMO_CODES.RIDE25;

  test('caps the discount at maxDiscount when raw percent would exceed it', () => {
    // 25% of 1,000 = 250 → clamped to 200
    const totals = computeTotals(1000, promo);
    expect(totals.discount).toBe(200);
    expect(totals.total).toBe(
      round(1000 - 200 + STANDARD_DELIVERY_UZS + SERVICE_FEE_UZS),
    );
  });

  test('does NOT cap when raw percent is below the cap', () => {
    // 25% of 400 = 100 → below the 200 cap, applied as-is
    const totals = computeTotals(400, promo);
    expect(totals.discount).toBe(100);
  });
});

describe('computeTotals — free_shipping promo (FREESHIP)', () => {
  const promo = PROMO_CODES.FREESHIP;

  test('zeros shipping, leaves discount and the service fee untouched', () => {
    const totals = computeTotals(SUBTOTAL, promo);
    expect(totals.discount).toBe(0);
    expect(totals.shipping).toBe(0);
    expect(totals.serviceFee).toBe(SERVICE_FEE_UZS);
    expect(totals.total).toBe(round(SUBTOTAL + SERVICE_FEE_UZS));
  });
});

describe('computeTotals — fixed promo (synthetic)', () => {
  const promo: PromoCode = {
    code: 'TEST50',
    label: '50 off',
    kind: 'fixed',
    value: 50,
  };

  test('subtracts the fixed amount', () => {
    const totals = computeTotals(200, promo);
    expect(totals.discount).toBe(50);
    expect(totals.total).toBe(
      round(200 - 50 + STANDARD_DELIVERY_UZS + SERVICE_FEE_UZS),
    );
  });

  test('does not let discount exceed subtotal', () => {
    // Promo value > subtotal: discount caps at subtotal, so the discounted
    // base is 0 but the flat fees still apply.
    const totals = computeTotals(30, promo);
    expect(totals.discount).toBe(30);
    expect(totals.total).toBe(round(STANDARD_DELIVERY_UZS + SERVICE_FEE_UZS));
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
  test('floating-point edge case: WELCOME10 on 19,640', () => {
    const totals = computeTotals(19640, PROMO_CODES.WELCOME10);
    expect(totals.subtotal).toBe(19640);
    expect(totals.discount).toBe(1964);
    expect(totals.shipping).toBe(STANDARD_DELIVERY_UZS);
    expect(totals.serviceFee).toBe(SERVICE_FEE_UZS);
    expect(totals.total).toBe(round(19640 - 1964 + STANDARD_DELIVERY_UZS + SERVICE_FEE_UZS));
  });
});
