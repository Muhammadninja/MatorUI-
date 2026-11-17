import { describe, expect, test } from 'vitest';

import {
  calendarDayAsLocalDate,
  mailtoUrl,
  RETURN_WINDOW_DAYS,
  returnSupportMessage,
  returnWindow,
  telegramUrl,
} from '@/services/return-support';

describe('returnWindow', () => {
  // Instants in UTC; the expected days are Tashkent days (UTC+5), so the test
  // means the same thing whatever zone the machine running it is in.
  const delivered = '2026-11-12T09:05:00.000Z'; // 14:05 on 12 Nov in Tashkent

  test('is ten calendar days counted from the day after receipt', () => {
    expect(RETURN_WINDOW_DAYS).toBe(10);
    const w = returnWindow(delivered, new Date('2026-11-13T06:00:00Z'))!;
    expect(w.receivedDay).toEqual({ year: 2026, month: 10, day: 12 });
    expect(w.lastDay).toEqual({ year: 2026, month: 10, day: 22 });
    expect(w.open).toBe(true);
  });

  test('is open until midnight in Tashkent at the end of the last day', () => {
    // 23:59 on 22 Nov in Tashkent = 18:59 UTC.
    expect(returnWindow(delivered, new Date('2026-11-22T18:59:59Z'))!.open).toBe(true);
    // 00:00 on 23 Nov in Tashkent = 19:00 UTC on the 22nd.
    expect(returnWindow(delivered, new Date('2026-11-22T19:00:00Z'))!.open).toBe(false);
  });

  test('a late-evening delivery counts on the Tashkent day, not the UTC day', () => {
    // 20:30 UTC on 12 Nov is already 01:30 on 13 Nov in Tashkent.
    const w = returnWindow('2026-11-12T20:30:00Z', new Date('2026-11-13T06:00:00Z'))!;
    expect(w.receivedDay).toEqual({ year: 2026, month: 10, day: 13 });
    expect(w.lastDay).toEqual({ year: 2026, month: 10, day: 23 });
  });

  test('crosses a month and a year boundary', () => {
    expect(returnWindow('2026-11-25T04:00:00Z')!.lastDay).toEqual({ year: 2026, month: 11, day: 5 });
    expect(returnWindow('2026-12-28T04:00:00Z')!.lastDay).toEqual({ year: 2027, month: 0, day: 7 });
  });

  test('formats as the same day in any device zone', () => {
    const d = calendarDayAsLocalDate({ year: 2026, month: 10, day: 22 });
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 22]);
  });

  test('is unknown when the backend gave no delivery time', () => {
    expect(returnWindow(undefined)).toBeNull();
    expect(returnWindow(null)).toBeNull();
    expect(returnWindow('not a date')).toBeNull();
  });
});

describe('support links', () => {
  test('the message carries the product only when one is chosen', () => {
    expect(returnSupportMessage({ head: 'Order #A1' })).toBe('Order #A1');
    expect(returnSupportMessage({ head: 'Order #A1', product: 'Pads (p1)' })).toBe(
      'Order #A1\nPads (p1)',
    );
  });

  test('Telegram opens the chat with the message in the input field', () => {
    expect(telegramUrl('Mator_AutoParts', 'Заказ #A1\nТовар: Колодки & диски')).toBe(
      'https://t.me/Mator_AutoParts?text=' +
        encodeURIComponent('Заказ #A1\nТовар: Колодки & диски'),
    );
    expect(telegramUrl('Mator_AutoParts')).toBe('https://t.me/Mator_AutoParts');
  });

  test('e-mail carries subject and body, encoded', () => {
    expect(mailtoUrl('a@b.uz', 'Return #A1', 'Line 1\nLine 2')).toBe(
      'mailto:a@b.uz?subject=Return%20%23A1&body=Line%201%0ALine%202',
    );
  });
});

describe('order detail mapping for returns', async () => {
  const { mapOrderToDetail } = await import('@/services/orders-api');
  const raw = {
    order_id: 'ord_1',
    status: 'delivered',
    currency: 'UZS',
    subtotal_uzs: 100_000,
    total_uzs: 100_000,
    items: [
      { part_id: 'part_1', title: 'Колодки', qty: 1, price_uzs: 100_000, line_total_uzs: 100_000 },
    ],
  };

  test('carries when the order was delivered and which product each line is', () => {
    const detail = mapOrderToDetail({ ...raw, delivered_at: '2026-11-12T09:05:00.000Z' });
    expect(detail.deliveredAt).toBe('2026-11-12T09:05:00.000Z');
    expect(detail.items[0].productId).toBe('part_1');
  });

  test('an older backend without delivered_at leaves it absent', () => {
    expect(mapOrderToDetail(raw).deliveredAt).toBeUndefined();
    expect(mapOrderToDetail({ ...raw, delivered_at: null }).deliveredAt).toBeUndefined();
  });
});
