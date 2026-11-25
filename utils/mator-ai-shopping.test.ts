import { describe, expect, test, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('expo-router', () => ({ router: { push } }));

import { buildMatorAIShoppingDraft, openMatorAIShopping } from './mator-ai-shopping';

describe('Mator AI shopping handoff', () => {
  test('keeps query, vehicle, category, and filters in the editable prompt', () => {
    const prompt = buildMatorAIShoppingDraft(
      {
        source: 'filter_zero_results',
        intent: 'find_part',
        searchQuery: 'brake pads',
        vehicle: '2020 Chevrolet Cobalt',
        categoryId: 'cat_brakes',
        categoryLabel: 'Brakes',
        filters: { categories: ['cat_brakes'], price: 'any' },
      },
      'en',
    );
    expect(prompt).toContain('brake pads');
    expect(prompt).toContain('2020 Chevrolet Cobalt');
    expect(prompt).toContain('Brakes');
    // Internal ids and analytics labels never land in the shopper's composer.
    expect(prompt).not.toMatch(/cat_brakes|filter_zero_results|Filters:/);
  });

  test('prepares a product photo request with identifying details without sending it', () => {
    push.mockClear();
    openMatorAIShopping(
      {
        source: 'product_photo_request',
        intent: 'request_photo',
        productId: 'part-1',
        productName: 'Oil filter',
        manufacturer: 'Bosch',
        partNumber: 'BOS-10042',
        oemNumbers: ['GM-42'],
      },
      'ru',
    );
    expect(push).toHaveBeenCalledTimes(1);
    const route = push.mock.calls[0]?.[0] as {
      params: { shoppingPrompt: string; shoppingSource: string };
    };
    expect(route.params.shoppingSource).toBe('product_photo_request');
    expect(route.params.shoppingPrompt).not.toContain('part-1');
    expect(route.params.shoppingPrompt).toContain('Bosch');
    expect(route.params.shoppingPrompt).toContain('BOS-10042');
    expect(route.params.shoppingPrompt).toContain('GM-42');
    expect(route.params.shoppingPrompt).toContain('запросите');
  });
});
