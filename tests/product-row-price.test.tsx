/**
 * The listing card's price line (physical iPhone, Dark Mode report): the amount
 * shrank to a few pixels and "сум" drifted away from it.
 *
 *   - The amount clears the `body` line height. A hard `lineHeight` paired with
 *     `adjustsFontSizeToFit` is what makes iOS shrink past `minimumFontScale`.
 *   - Amount and currency sit on one line that never wraps.
 *   - The add button stays beside them.
 */
import React from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

import type { CatalogItem } from '@/services/catalog-service';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));

vi.mock('react-native', () => ({
  View: host('rn-view'),
  useWindowDimensions: () => ({ width: 375, height: 667, fontScale: 1 }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => (k === 'common.currency' ? 'сум' : k) }),
}));
vi.mock('lucide-react-native', () => ({
  Check: () => null,
  CircleAlert: () => null,
  Heart: () => null,
  Plus: () => null,
  X: () => null,
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-icon-button', () => ({ AppIconButton: host('icon-button') }));
vi.mock('@/components/shared/wheel-loader/wheel-loader', () => ({ default: () => null }));
vi.mock('@/components/screens-components/home/image-box', () => ({ default: () => null }));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: new Proxy({}, { get: (_t, k) => `#${String(k)}` }) }),
}));
vi.mock('@/contexts/active-vehicle.context', () => ({
  useActiveVehicle: () => ({ currentActiveVehicle: null }),
}));
vi.mock('@/contexts/likes.context', () => ({
  useLikesContext: () => ({ isLiked: () => false, toggleLike: () => true }),
}));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ isAuthenticated: true }) }));
vi.mock('@/hooks/use-sales', () => ({ useActiveSales: () => [] }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ info: () => {}, success: () => {}, warning: () => {} }),
}));
vi.mock('@/services/compatibility-service', () => ({ checkCompatibility: async () => null }));
vi.mock('@/services/sales-service', () => ({
  resolveItemPricing: () => ({ savePct: 0, wasUzs: 0 }),
}));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));

const { default: ProductRow, priceFontSize } =
  await import('@/components/screens-components/catalog/product-row');

function render(price: string, title = 'Колодки') {
  const item = { id: 'p1', title, price, images: [] } as unknown as CatalogItem;
  let root!: ReturnType<typeof create>;
  act(() => {
    root = create(<ProductRow item={item} onOpen={() => {}} onAdd={() => {}} />);
  });
  return root.root;
}

function priceLine(tree: ReactTestInstance) {
  const line = tree.find((n) => n.props.testID === 'part-price-p1' && String(n.type) === 'rn-view');
  const [amount, currency] = line.findAll((n) => String(n.type) === 'text');
  return { line, amount, currency };
}

describe('product card price line', () => {
  test.each(['UZS 89 000', '1 250 000 сум', 'UZS 12 345 678.50'])(
    'keeps %s and its currency together on one line',
    (price) => {
      const { line, amount, currency } = priceLine(render(price));
      expect(line.props.style.flexWrap).toBe('nowrap');
      expect(amount.props.numberOfLines).toBe(1);
      expect(currency.props.children).toBe('сум');
      expect(currency.props.style.flexShrink).toBe(0);
    },
  );

  test('the amount clears the inherited line height it auto-shrinks with', () => {
    const { amount } = priceLine(render('1 250 000 сум'));
    expect(amount.props.adjustsFontSizeToFit).toBe(true);
    expect('lineHeight' in amount.props.style).toBe(true);
    expect(amount.props.style.lineHeight).toBeUndefined();
    expect(amount.props.style.flexShrink).toBe(1);
    expect(amount.props.style.minWidth).toBe(0);
    // Digit groups are non-breaking, so the amount cannot split.
    expect(amount.props.children).toBe('1 250 000');
  });

  test('large amounts step down to a readable size, never below 14', () => {
    expect(priceFontSize('89 000')).toBe(18);
    expect(priceFontSize('1 250 000')).toBe(16);
    expect(priceFontSize('12 345 678.50')).toBe(14);
  });

  test('a long title does not displace the add button', () => {
    const tree = render('1 250 000 сум', 'Очень длинное название запчасти '.repeat(4));
    expect(tree.findAll((n) => String(n.type) === 'icon-button')).toHaveLength(1);
  });
});
