/**
 * The listing card's price line.
 *
 *   - Physical iPhone, Dark Mode: the amount shrank to a few pixels. A hard
 *     `lineHeight` paired with `adjustsFontSizeToFit` is what makes iOS shrink
 *     past `minimumFontScale`, so the amount clears the `body` line height.
 *   - Physical Android, 360dp: cards had dead space between the fitment link
 *     and the price. The card now shows the bare amount (no "сум") in larger
 *     type beside a 36dp add button.
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

function priceText(tree: ReactTestInstance) {
  return tree.find((n) => n.props.testID === 'part-price-p1' && String(n.type) === 'text');
}

/** Every string a sighted user sees on the card. */
function visibleStrings(tree: ReactTestInstance): string[] {
  return tree
    .findAll((n) => String(n.type) === 'text')
    .flatMap((n) => [n.props.children].flat())
    .filter((c): c is string => typeof c === 'string');
}

describe('product card price line', () => {
  test.each([
    ['UZS 89 000', '89\u00a0000'],
    ['1 250 000 сум', '1\u00a0250\u00a0000'],
  ])('shows %s as the bare amount, on one line', (price, amount) => {
    const tree = render(price);
    const text = priceText(tree);
    expect(text.props.children).toBe(amount);
    expect(text.props.numberOfLines).toBe(1);
    expect(visibleStrings(tree).some((s) => /сум|UZS/.test(s))).toBe(false);
  });

  test('screen readers still hear the currency', () => {
    expect(priceText(render('1 250 000 сум')).props.accessibilityLabel).toBe(
      '1\u00a0250\u00a0000 сум',
    );
  });

  test('the amount clears the inherited line height it auto-shrinks with', () => {
    const text = priceText(render('1 250 000 сум'));
    expect(text.props.adjustsFontSizeToFit).toBe(true);
    expect('lineHeight' in text.props.style).toBe(true);
    expect(text.props.style.lineHeight).toBeUndefined();
    expect(text.props.style.minWidth).toBe(0);
  });

  test('prices are set larger, and long amounts step down, never below 15', () => {
    expect(priceFontSize('89 000')).toBe(21);
    expect(priceFontSize('1 250 000')).toBe(18);
    expect(priceFontSize('12 345 678.50')).toBe(15);
  });

  test('the add button is compact and sits level with the price', () => {
    const tree = render('545 000 сум');
    const button = tree.find((n) => String(n.type) === 'icon-button');
    expect(button.props.size).toBe(36);
    const row = tree.find(
      (n) =>
        String(n.type) === 'view' &&
        n.props.row === true &&
        n.findAll((c) => String(c.type) === 'icon-button').length === 1,
    );
    expect(row.props.align).toBe('center');
  });

  test('the fitment link and the price share one footer pinned to the card foot', () => {
    const tree = render('545 000 сум');
    const footer = tree.find(
      (n) => String(n.type) === 'view' && n.props.style?.marginTop === 'auto',
    );
    const host = (type: string) => (n: ReactTestInstance) => String(n.type) === type;
    expect(
      footer
        .findAll(host('pressable'))
        .filter((n) => n.props.accessibilityLabel === 'catalog.checkFitAccessibility'),
    ).toHaveLength(1);
    expect(
      footer.findAll(host('text')).filter((n) => n.props.testID === 'part-price-p1'),
    ).toHaveLength(1);
  });

  test('a long title does not displace the add button', () => {
    const tree = render('1 250 000 сум', 'Очень длинное название запчасти '.repeat(4));
    expect(tree.findAll((n) => String(n.type) === 'icon-button')).toHaveLength(1);
  });
});
