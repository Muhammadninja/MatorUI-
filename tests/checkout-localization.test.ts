import { createInstance } from 'i18next';
import { describe, expect, test, vi } from 'vitest';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';
import en from '@/locales/en.json';
vi.mock('lucide-react-native', () => ({ Banknote: () => null, CreditCard: () => null, Wallet: () => null }));
import { PAYMENT_OPTIONS } from '@/constants/payment-options';
import {
  addressSaveErrorKey,
  composeLine1,
  deliveryRefusalKey,
  formatAddressLine,
  isAwaitingOnlinePayment,
  orderPaymentState,
  paymentFailureKey,
  paymentFailureTitleKey,
  paymentRefusalReason,
  quoteErrorAction,
  quoteErrorKey,
  resolveCheckoutDelivery,
  splitLine1,
} from '@/services/checkout-presentation';

const resources = { ru: { translation: ru }, uz: { translation: uz }, en: { translation: en } };

test.each([
  ['ru', 'Самовывоз', 'Наличные', 'Стоимость доставки: 32 500 сум'],
  ['uz', 'Olib ketish', 'Naqd pul', 'Yetkazib berish narxi: 32 500 soʻm'],
  ['en', 'Pickup', 'Cash', 'Delivery cost: 32 500 UZS'],
])('checkout copy follows %s', async (lng, pickup, cash, price) => {
  const i18n = createInstance();
  await i18n.init({ lng, resources });
  expect(i18n.t('checkout.pickup')).toBe(pickup);
  expect(
    i18n.t('checkout.deliveryPrice', { price: `32 500 ${i18n.t('common.currency')}` }),
  ).toBe(price);
  expect(PAYMENT_OPTIONS.map((p) => p.id)).toEqual(['payme', 'terminal', 'cash']);
  expect(i18n.t(PAYMENT_OPTIONS[2].labelKey)).toBe(cash);
  for (const p of PAYMENT_OPTIONS) {
    expect(i18n.exists(p.labelKey)).toBe(true);
    expect(i18n.exists(p.descriptionKey)).toBe(true);
  }
});

const REFUSALS = [
  'DELIVERY_ADDRESS_COORDINATES_MISSING',
  'DELIVERY_ADDRESS_REQUIRED',
  'PICKUP_LOCATION_MISSING',
  'DELIVERY_ROUTE_NOT_FOUND',
  'DELIVERY_ROUTING_UNAVAILABLE',
  'DELIVERY_COST_UNAVAILABLE',
  'DELIVERY_PRICE_CHANGED',
  'DELIVERY_QUOTE_STALE',
  'DELIVERY_OUTSIDE_COVERAGE',
  'DELIVERY_ADDRESS_COORDINATES_INVALID',
  'COURIER_DELIVERY_UNAVAILABLE',
];

test.each(['ru', 'uz', 'en'])('every delivery refusal has its own words in %s', async (lng) => {
  const i18n = createInstance();
  await i18n.init({ lng, resources });
  for (const code of REFUSALS) {
    const key = deliveryRefusalKey(code);
    expect(key).not.toBeNull();
    expect(i18n.exists(key as string)).toBe(true);
  }
  expect(i18n.exists(quoteErrorKey('SOMETHING_ELSE'))).toBe(true);
});

test('the checkout copy holds no route, distance or time, in any language', () => {
  const words = [ru.checkout, uz.checkout, en.checkout].flatMap(Object.values).join(' | ');
  expect(words).not.toMatch(/маршрут|route|\bkm\b|километр|minut|минут|\beta\b|сегодня|today/i);
});

test('a refusal about something else keeps the server message', () => {
  expect(deliveryRefusalKey('PART_UNAVAILABLE')).toBeNull();
  expect(deliveryRefusalKey(null)).toBeNull();
});

test('what the buyer can do about each failed quote', () => {
  expect(quoteErrorAction('DELIVERY_ADDRESS_COORDINATES_MISSING')).toBe('edit_address');
  expect(quoteErrorAction('DELIVERY_ADDRESS_COORDINATES_INVALID')).toBe('edit_address');
  expect(quoteErrorAction('DELIVERY_OUTSIDE_COVERAGE')).toBe('edit_address');
  expect(quoteErrorAction('DELIVERY_ROUTE_NOT_FOUND')).toBe('edit_address');
  expect(quoteErrorAction('DELIVERY_ROUTING_UNAVAILABLE')).toBe('retry');
  expect(quoteErrorAction('TIMEOUT')).toBe('retry');
  expect(quoteErrorAction(null)).toBe('retry');
  expect(quoteErrorAction('PICKUP_LOCATION_MISSING')).toBeNull();
  expect(quoteErrorAction('COURIER_DELIVERY_UNAVAILABLE')).toBeNull();
});

const allCopy = (lng: 'ru' | 'uz' | 'en') => ({ ru, uz, en })[lng];

test.each(['ru', 'uz', 'en'] as const)('every payment failure has its own words in %s', async (lng) => {
  const i18n = createInstance();
  await i18n.init({ lng, resources });
  for (const reason of ['fiscal', 'parts', 'start', 'cancelled', 'unconfirmed', 'unpaid'] as const) {
    expect(i18n.exists(paymentFailureKey(reason))).toBe(true);
    expect(i18n.exists(paymentFailureTitleKey(reason))).toBe(true);
  }
  expect(i18n.exists(addressSaveErrorKey('DELIVERY_OUTSIDE_COVERAGE'))).toBe(true);
  expect(i18n.exists(addressSaveErrorKey('DELIVERY_ADDRESS_COORDINATES_INVALID'))).toBe(true);
  expect(i18n.exists(addressSaveErrorKey('ANYTHING_ELSE'))).toBe(true);
  expect(allCopy(lng).account.pinnedLocationLabel).toBeTruthy();
});

test('a payment failure is called what it is: refused, or just not done yet', () => {
  expect(paymentRefusalReason('FISCAL_DATA_INCOMPLETE')).toBe('fiscal');
  expect(paymentRefusalReason('PART_UNAVAILABLE')).toBe('parts');
  expect(paymentRefusalReason('NETWORK')).toBe('start');
  expect(paymentRefusalReason(null)).toBe('start');
  expect(paymentFailureTitleKey('fiscal')).toBe('checkout.paymentFailedTitle');
  expect(paymentFailureTitleKey('cancelled')).toBe('checkout.paymentUnpaidTitle');
});

describe('what an order status says about its payment', () => {
  test.each([
    ['pending_payment', 'awaiting'],
    ['paid', 'settled'],
    ['processing', 'settled'],
    ['shipped', 'settled'],
    ['delivered', 'settled'],
    ['cancelled', 'closed'],
    ['expired', 'closed'],
    ['refunded', 'closed'],
    ['some_new_status', 'unknown'],
    [undefined, 'unknown'],
    [null, 'unknown'],
  ])('%s → %s', (status, state) => {
    expect(orderPaymentState(status)).toBe(state);
  });

  test('only a Payme order waiting for payment is waiting for the buyer to pay', () => {
    expect(isAwaitingOnlinePayment({ serverStatus: 'pending_payment', paymentType: 'payme' })).toBe(true);
    expect(isAwaitingOnlinePayment({ serverStatus: 'pending_payment', paymentType: 'cash' })).toBe(false);
    expect(isAwaitingOnlinePayment({ serverStatus: 'pending_payment', paymentType: 'terminal' })).toBe(false);
    expect(isAwaitingOnlinePayment({ serverStatus: 'pending_payment', paymentType: null })).toBe(false);
    expect(isAwaitingOnlinePayment({ serverStatus: 'paid', paymentType: 'payme' })).toBe(false);
  });
});

describe('an address in fields and as one line', () => {
  test.each([
    ['Навои 12', 'Навои', '12'],
    ['Навои 12a', 'Навои', '12a'],
    ['Навои 12/1', 'Навои', '12/1'],
    ['Амира Темура 7', 'Амира Темура', '7'],
    ['Навои', 'Навои', ''],
    ['12', '12', ''],
    ['', '', ''],
  ])('%s splits and joins back', (line1, street, house) => {
    expect(splitLine1(line1)).toEqual({ street, house });
    expect(composeLine1(street, house)).toBe(line1);
  });

  test.each(['Навои,  12', 'ул. Амира Темура, 12, кв. 6', '128 Marrakesh Rd, Suite 4'])(
    '%s comes back exactly, so an unedited address is known to be unedited',
    (line1) => {
      const { street, house } = splitLine1(line1);
      expect(composeLine1(street, house)).toBe(line1);
    },
  );

  test('a point with no words has no line at all, and no stray comma', () => {
    expect(formatAddressLine({ line1: '', city: '' })).toBe('');
    expect(formatAddressLine({ line1: 'Навои 1', city: '' })).toBe('Навои 1');
    expect(formatAddressLine({ line1: 'Навои 1', city: 'Ташкент' })).toBe('Навои 1, Ташкент');
  });
});

describe('resolveCheckoutDelivery', () => {
  const courier = { key: 'courier', label: 'Kuryer', price: 32500, quoteId: 'quote_1' };
  const base = {
    hasAddress: true,
    addressSkipped: false,
    method: 'courier' as const,
    quoteState: 'success' as const,
    options: [courier],
  };

  test('a priced courier can be ordered, at that price', () => {
    expect(resolveCheckoutDelivery(base)).toEqual({
      method: 'courier',
      fee: 32500,
      ready: true,
      quoteId: 'quote_1',
    });
  });

  test.each([
    ['still loading', { quoteState: 'loading' as const }],
    ['failed', { quoteState: 'error' as const, options: [] }],
    ['not asked yet', { quoteState: 'idle' as const, options: [] }],
    ['answered with no courier', { options: [] }],
    ['answered with something else', { options: [{ key: 'pickup', label: '', price: 0 }] }],
  ])('a courier quote that is %s has no price and cannot be ordered', (_, over) => {
    expect(resolveCheckoutDelivery({ ...base, ...over })).toEqual({
      method: 'courier',
      fee: null,
      ready: false,
      quoteId: null,
    });
  });

  test('pickup needs no quote, however the quote went', () => {
    expect(
      resolveCheckoutDelivery({ ...base, method: 'pickup', quoteState: 'error', options: [] }),
    ).toEqual({ method: 'pickup', fee: 0, ready: true, quoteId: null });
  });

  test('no address: pickup once the buyer chose to skip it, and nothing before that', () => {
    expect(
      resolveCheckoutDelivery({ ...base, hasAddress: false, addressSkipped: true }),
    ).toEqual({ method: 'pickup', fee: 0, ready: true, quoteId: null });
    expect(resolveCheckoutDelivery({ ...base, hasAddress: false })).toEqual({
      method: 'pickup',
      fee: null,
      ready: false,
      quoteId: null,
    });
  });

  test('a backend answering a real zero is free, as a cart of services alone is', () => {
    expect(
      resolveCheckoutDelivery({ ...base, options: [{ ...courier, price: 0 }] }),
    ).toEqual({ method: 'courier', fee: 0, ready: true, quoteId: 'quote_1' });
  });
});
