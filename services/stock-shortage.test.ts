import { describe, expect, it } from 'vitest';

import {
  alternativeQuantity,
  shortageCauseKey,
  stockShortageLines,
} from '@/services/stock-shortage';

const details = {
  lines: [
    {
      part_id: 'part_stock_1',
      requested_quantity: 5,
      available_quantity: 2,
      cause: 'source_stock',
      sourcing_requested: true,
      alternatives: [
        {
          part_id: 'other',
          title: 'Filter',
          seller_name: 'Other Dealer',
          price_uzs: 1500,
          available_quantity: 3,
          covers_requested: false,
        },
        { part_id: 'broken' },
      ],
    },
  ],
};

describe('a stock refusal', () => {
  it('reads each part, the cause and the alternatives the server sent', () => {
    const [line] = stockShortageLines('PART_UNAVAILABLE', details);
    expect(line).toMatchObject({
      partId: 'part_stock_1',
      requestedQuantity: 5,
      availableQuantity: 2,
      cause: 'source_stock',
      sourcingRequested: true,
    });
    expect(line!.alternatives).toEqual([
      {
        partId: 'other',
        title: 'Filter',
        sellerName: 'Other Dealer',
        priceUzs: 1500,
        availableQuantity: 3,
        coversRequested: false,
      },
    ]);
  });

  it('a partial alternative offers only what it has', () => {
    const [line] = stockShortageLines('PART_UNAVAILABLE', details);
    expect(alternativeQuantity(line!, line!.alternatives[0]!)).toBe(3);
  });

  it('an uncounted alternative offers what was asked', () => {
    const [line] = stockShortageLines('PART_UNAVAILABLE', details);
    expect(alternativeQuantity(line!, { ...line!.alternatives[0]!, availableQuantity: null })).toBe(5);
  });

  it('held stock is not described as missing', () => {
    expect(shortageCauseKey('reserved')).toBe('checkout.stockReserved');
    expect(shortageCauseKey('source_stock')).toBe('checkout.stockSourceShort');
  });

  it('any other refusal, or an older server, has no lines', () => {
    expect(stockShortageLines('ORDER_TOTAL_CHANGED', details)).toEqual([]);
    expect(stockShortageLines('PART_UNAVAILABLE', undefined)).toEqual([]);
    expect(stockShortageLines('PART_UNAVAILABLE', { lines: [{ part_id: 'x', requested_quantity: 1, available_quantity: 0 }] })[0]).toMatchObject({ cause: null, alternatives: [] });
  });
});
