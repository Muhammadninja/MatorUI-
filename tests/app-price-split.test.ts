import { expect, test, vi } from 'vitest';

vi.mock('@/components/shared/app-text', () => ({ AppText: () => null }));
vi.mock('@/components/shared/app-view', () => ({ AppView: () => null }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { splitPrice } from '@/components/shared/app-price';

test.each(["95 730.24 so'm", '95 730.24 UZS', 'UZS 95 730.24', '95 730,24 сум', '95 730.24 soʻm'])(
  'som hundredths stay in the amount: %s',
  (price) => {
    const { amount, cents } = splitPrice(price);
    expect(amount).toBe('95 730.24');
    expect(cents).toBeUndefined();
  },
);

test('whole som has no fraction, and another currency keeps raised cents', () => {
  expect(splitPrice("280 000 so'm")).toEqual({ currency: "so'm", amount: '280 000' });
  expect(splitPrice('$64.99')).toEqual({ currency: '$', amount: '64', cents: '99' });
});
