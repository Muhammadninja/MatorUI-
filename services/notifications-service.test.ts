import { describe, expect, it } from 'vitest';

import { mapRawNotification } from './notifications-service';

describe('mapRawNotification — sourcing offers', () => {
  it('maps a sourcing_offer row to a success tone with a parsed offer payload', () => {
    const item = mapRawNotification({
      id: 'ntf_1',
      type: 'SOURCING_OFFER',
      title: 'Нашли вашу запчасть 🎉',
      body: 'Тормозные колодки — 250 000 UZS',
      deeplink_path: '/sourcing/offer/soff_1',
      read: false,
      created_at: new Date().toISOString(),
      data: {
        offerId: 'soff_1',
        partName: 'Тормозные колодки',
        price: 250000,
        currency: 'UZS',
        condition: 'USED',
        imageUrl: 'https://cdn/x.png',
      },
    });

    expect(item.type).toBe('sourcing_offer');
    expect(item.tone).toBe('success');
    expect(item.deeplinkPath).toBe('/sourcing/offer/soff_1');
    expect(item.offer).toMatchObject({
      offerId: 'soff_1',
      price: 250000,
      partName: 'Тормозные колодки',
      imageUrl: 'https://cdn/x.png',
    });
  });

  it('handles a price-only offer (no imageUrl in data)', () => {
    const item = mapRawNotification({
      id: 'ntf_2',
      type: 'SOURCING_OFFER',
      title: 'Нашли вашу запчасть 🎉',
      body: 'Радиатор — 800 000 UZS',
      data: { offerId: 'soff_2', price: 800000, partName: 'Радиатор' },
    });

    expect(item.offer?.imageUrl).toBeUndefined();
    expect(item.offer?.price).toBe(800000);
  });

  it('leaves non-offer notifications without an offer payload', () => {
    const item = mapRawNotification({
      id: 'ntf_3',
      type: 'ORDER_PAID',
      title: 'Заказ оплачен',
      body: 'Ваш заказ оплачен',
    });

    expect(item.offer).toBeUndefined();
    expect(item.tone).toBe('info'); // "order" matches before "paid" (pre-existing)
  });
});
