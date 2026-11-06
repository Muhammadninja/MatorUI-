/**
 * The checkout's money, from the backend's figures alone: the app holds no tariff and works
 * out no fee, so these only add what the server said, to the tiyin.
 */
import { describe, expect, test } from 'vitest';

import { parseCartCharges } from './cart-api';
import { addUzs } from './cart-math';
import { checkoutTotal, orderRefusalKey } from './checkout-presentation';

const SERVER = { subtotal: 600_000, discount: 0, serviceFee: 20_000, total: 620_000 };

describe('checkoutTotal', () => {
  test('the cart’s total, which holds the fee, plus delivery', () => {
    expect(checkoutTotal(SERVER, 25_000, true)).toBe(645_000);
  });

  test('pickup adds nothing', () => {
    expect(checkoutTotal(SERVER, 0, true)).toBe(620_000);
  });

  test.each([
    ['the server has not stated the cart', null, 25_000, true],
    ['there is no delivery price yet', SERVER, null, true],
    ['a change to the cart is on its way', SERVER, 25_000, false],
  ])('no total while %s', (_, charges, delivery, settled) => {
    expect(checkoutTotal(charges, delivery, settled)).toBeNull();
  });

  test('fractional figures add up to the tiyin', () => {
    expect(addUzs(64_516.71, 15_000)).toBe(79_516.71);
    expect(checkoutTotal({ ...SERVER, total: 0.1 }, 0.2, true)).toBe(0.3);
  });
});

describe('parseCartCharges', () => {
  test('reads what the backend stated', () => {
    expect(
      parseCartCharges({
        subtotal_uzs: 600_000,
        discount_uzs: 0,
        service_fee_uzs: 20_000,
        total_uzs: 620_000,
      }),
    ).toEqual(SERVER);
  });

  test.each([
    ['no fee stated', { subtotal_uzs: 600_000, total_uzs: 600_000 }],
    ['no total', { subtotal_uzs: 600_000, service_fee_uzs: 20_000 }],
    ['a fee that is no amount', { subtotal_uzs: 1, service_fee_uzs: -1, total_uzs: 1 }],
    ['nothing', null],
  ])('assumes nothing on %s', (_, cart) => {
    expect(parseCartCharges(cart as never)).toBeNull();
  });

  test('a missing discount is none', () => {
    expect(
      parseCartCharges({ subtotal_uzs: 90_000, service_fee_uzs: 0, total_uzs: 90_000 }),
    ).toEqual({ subtotal: 90_000, discount: 0, serviceFee: 0, total: 90_000 });
  });
});

describe('orderRefusalKey', () => {
  test('a changed total is worded, like a changed delivery price', () => {
    expect(orderRefusalKey('ORDER_TOTAL_CHANGED')).toBe('checkout.orderTotalChanged');
    expect(orderRefusalKey('DELIVERY_PRICE_CHANGED')).toBe('checkout.deliveryPriceChanged');
  });

  test('anything else is not this kind of refusal', () => {
    expect(orderRefusalKey('PART_UNAVAILABLE')).toBeNull();
    expect(orderRefusalKey(null)).toBeNull();
  });
});
