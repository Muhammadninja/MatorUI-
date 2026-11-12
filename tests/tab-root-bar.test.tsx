/**
 * The tab bar belongs to each tab's ROOT screen (physical iPhone report: the
 * bar vanished for ~2 s on a back swipe).
 *
 * The navigator used to draw it and hide it whenever the nested stack focused a
 * pushed screen. The stack only pops in JS after the native transition, so the
 * root was revealed bar-less for the whole swipe. Now:
 *   - the navigator draws no bar at all, whatever its nested state;
 *   - each root renders the bar while its TAB is selected, even when a pushed
 *     screen holds stack focus (that is exactly the back-swipe moment);
 *   - it still hides for the search surface and on unselected tabs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));

type Listener = () => void;
const tabNav = {
  focused: true,
  listeners: { focus: new Set<Listener>(), blur: new Set<Listener>() },
  navigate: vi.fn(),
  isFocused: () => tabNav.focused,
  addListener: (e: 'focus' | 'blur', cb: Listener) => {
    tabNav.listeners[e].add(cb);
    return () => tabNav.listeners[e].delete(cb);
  },
  emit(e: 'focus' | 'blur') {
    tabNav.focused = e === 'focus';
    tabNav.listeners[e].forEach((cb) => cb());
  },
};
// The root's own stack navigation; the tab navigator is its parent.
const stackNav = { getParent: () => tabNav };
vi.mock('expo-router', () => ({ useNavigation: () => stackNav }));

let searchActive = false;
vi.mock('@/contexts/search-ui.context', () => ({
  useSearchUIContext: () => ({ isSearchActive: searchActive }),
}));
vi.mock('@/contexts/cart.context', () => ({ useCartContext: () => ({ itemCount: 3 }) }));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: new Proxy({}, { get: (_t, k) => `#${String(k)}` }) }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('react-native', () => ({ View: host('rn-view') }));
vi.mock('lucide-react-native', () => ({
  CarFront: () => null,
  Search: () => null,
  ShoppingBag: () => null,
  Sparkles: () => null,
  User: () => null,
}));
vi.mock('@/components/shared/app-tab-bar/app-tab-bar', () => ({ default: host('tab-bar') }));

const { TabRootBar, withTabBar } = await import('@/components/shared/app-tab-bar/tab-root');

function bars(tree: ReturnType<typeof create>) {
  return tree.root.findAll((n) => String(n.type) === 'tab-bar');
}

beforeEach(() => {
  searchActive = false;
  tabNav.focused = true;
  tabNav.navigate.mockClear();
  tabNav.listeners.focus.clear();
  tabNav.listeners.blur.clear();
});

describe('tab bar ownership', () => {
  test('the tab navigator draws no bar of its own', () => {
    const layout = readFileSync(join(__dirname, '../app/(tabs)/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/tabBar=\{NO_TAB_BAR\}/);
    expect(layout).toMatch(/const NO_TAB_BAR = \(\) => null/);
    expect(layout).not.toMatch(/AppTabBar/);
  });

  test.each(['explore', 'garage', 'ai-chat', 'cart', 'profile'])(
    'the (%s) root screen carries the bar',
    (tab) => {
      const route = readFileSync(join(__dirname, `../app/(tabs)/(${tab})/${tab}.tsx`), 'utf8');
      expect(route).toContain(`withTabBar(`);
      expect(route).toContain(`'(${tab})')`);
    },
  );

  test('a root keeps its bar under a pushed screen, so a back swipe reveals it', () => {
    const Screen = () => React.createElement('rn-view', { testID: 'screen' });
    const Root = withTabBar(Screen, '(explore)');
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Root />);
    });
    // Nothing about the stack's focus is consulted — only the tab's.
    const [bar] = bars(tree);
    expect(bar.props.activeKey).toBe('(explore)');
    expect(bar.props.items.map((i: { key: string }) => i.key)).toEqual([
      '(explore)',
      '(garage)',
      '(ai-chat)',
      '(cart)',
      '(profile)',
    ]);
    expect(tree.root.findAll((n) => n.props.testID === 'screen')).toHaveLength(1);
  });

  test('tab presses go to the tab navigator, and the cart shows its badge', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<TabRootBar tab="(garage)" />);
    });
    const items = bars(tree)[0].props.items as {
      key: string;
      onPress: () => void;
      badgeLabel?: string;
    }[];
    items.find((i) => i.key === '(cart)')!.onPress();
    expect(tabNav.navigate).toHaveBeenCalledWith('(cart)');
    expect(items.find((i) => i.key === '(cart)')!.badgeLabel).toBe('3');
  });

  test('an unselected tab draws nothing, and comes back on focus', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<TabRootBar tab="(profile)" />);
    });
    expect(bars(tree)).toHaveLength(1);
    act(() => tabNav.emit('blur'));
    expect(bars(tree)).toHaveLength(0);
    act(() => tabNav.emit('focus'));
    expect(bars(tree)).toHaveLength(1);
  });

  test('the search surface still hides it', () => {
    searchActive = true;
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<TabRootBar tab="(explore)" />);
    });
    expect(bars(tree)).toHaveLength(0);
  });
});
