import { expect, test, vi } from 'vitest';
vi.mock('lucide-react-native', () => ({ Award: () => null, BadgePercent: () => null, Sparkles: () => null, Tag: () => null }));
import { deriveCardVariant } from '@/components/screens-components/search/search-result-row/variant';
import { resolvePriceSignal } from '@/components/screens-components/search/search-result-row/signal';

test.each(['part_stock_6012', 'part_stock_6011', 'part_stock_3865', 'part_stock_3864'])(
  'real search item %s has no invented commercial ribbon', (id) => {
    const variant = deriveCardVariant(id);
    expect(resolvePriceSignal({ t: (key) => key, accentTagFallback: variant.accentTag })).toBeNull();
    expect(variant.delivery.labelKey).toBe('search.deliveryAtCheckout');
  },
);

test('server-supplied bestseller still renders without a synthetic fallback', () => {
  expect(resolvePriceSignal({ t: (key) => key, accentTagKind: 'bestseller', accentTagFallback: deriveCardVariant('part_stock_6011').accentTag }))
    .toMatchObject({ label: 'search.signal.bestseller', tone: 'accolade' });
});
