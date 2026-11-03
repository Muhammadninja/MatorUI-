/** Unit mapper regressions only: synthetic order, no HTTP or account access. */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const language = vi.hoisted(() => ({ isInitialized: true, language: 'en' }));
vi.mock('i18next', () => ({ default: language }));
vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => false }));
vi.mock('@/services/api-client', () => ({ apiClient: {}, ApiError: class extends Error {} }));

import { mapOrderToDetail, mapOrderToListRow, type RawBackendOrder } from '@/services/orders-api';

const ORDER: RawBackendOrder = {
  order_id: 'synthetic-date-order', status: 'shipped',
  created_at: new Date(2026, 6, 21, 12, 30).toISOString(),
  updated_at: new Date(2026, 6, 22, 12, 30).toISOString(),
  expires_at: new Date(2026, 6, 23, 12, 30).toISOString(),
  total_uzs: 280000, subtotal_uzs: 250000, delivery_uzs: 25000, service_fee_uzs: 5000,
  delivery_method: 'courier', delivery_address_id: 'synthetic-address',
  items: [{ part_id: 'synthetic-part', title: 'Synthetic part', qty: 2, price_uzs: 125000 }],
};

beforeEach(() => { language.isInitialized = true; language.language = 'en'; });
afterEach(() => vi.restoreAllMocks());

test.each([['en', 'en-US'], ['ru', 'ru-RU'], ['uz', 'uz-UZ']] as const)(
  '%s dates use the requested locale consistently in list, detail and placed step', (code, locale) => {
    language.language = code;
    const formatter = vi.spyOn(Date.prototype, 'toLocaleDateString');
    const row = mapOrderToListRow(ORDER);
    const detail = mapOrderToDetail(ORDER);
    expect(formatter).toHaveBeenCalledWith(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    expect(formatter).toHaveBeenCalledTimes(2);
    expect(row.date).toBe(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ORDER.created_at!)));
    expect(detail.placedAt).toBe(row.date);
    expect(detail.steps[0].caption).toBe(row.date);
    expect(detail.steps.slice(1).every((step) => step.caption === '')).toBe(true);
  },
);

test('changing date language leaves source timestamps and all non-date order data unchanged', () => {
  const original = JSON.stringify(ORDER);
  const englishRow = mapOrderToListRow(ORDER);
  const englishDetail = mapOrderToDetail(ORDER);
  language.language = 'ru';
  const russianRow = mapOrderToListRow(ORDER);
  const russianDetail = mapOrderToDetail(ORDER);
  expect(russianRow.date).not.toBe(englishRow.date);
  const { date: _enDate, ...enRowData } = englishRow;
  const { date: _ruDate, ...ruRowData } = russianRow;
  expect(ruRowData).toEqual(enRowData);
  const nonDateDetail = (detail: typeof englishDetail) => ({
    ...detail, placedAt: '', steps: detail.steps.map((step) => ({ ...step, caption: '' })),
  });
  expect(nonDateDetail(russianDetail)).toEqual(nonDateDetail(englishDetail));
  expect(JSON.stringify(ORDER)).toBe(original);
});

test.each([false, true])('uninitialized or unsupported locale retains the existing English fallback (initialized=%s)', (initialized) => {
  language.isInitialized = initialized;
  language.language = initialized ? 'unsupported' : 'ru';
  const formatter = vi.spyOn(Date.prototype, 'toLocaleDateString');
  expect(mapOrderToListRow(ORDER).date).toBe('Jul 21, 2026');
  expect(mapOrderToDetail(ORDER).placedAt).toBe('Jul 21, 2026');
  expect(formatter).not.toHaveBeenCalled();
});

test.each([undefined, '', 'invalid-date'])('missing or invalid source date stays empty (%s)', (createdAt) => {
  language.language = 'uz';
  const source = { ...ORDER, created_at: createdAt };
  expect(mapOrderToListRow(source).date).toBe('');
  const detail = mapOrderToDetail(source);
  expect(detail.placedAt).toBe('');
  expect(detail.steps[0].caption).toBe('');
});
