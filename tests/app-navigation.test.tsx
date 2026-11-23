// @vitest-environment jsdom
/**
 * Routing guards found in the 2026-11-22 routing audit (all reproduced on the
 * simulator before the fix):
 *  - a second Back tap while the screen animates out popped the screen under it
 *    (Settings → Back ×2 landed on Explore);
 *  - `navigate` to a tab from a root-stack screen pushed a second tab navigator;
 *  - a product opened from Garage / Assistant switched to the Explore tab.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const nav = vi.hoisted(() => ({
  calls: [] as string[],
  focused: true,
  canGoBack: true,
  segments: [] as string[],
}));

vi.mock('expo-router', () => ({
  router: {
    back: () => nav.calls.push('back'),
    canGoBack: () => nav.canGoBack,
    replace: (href: string) => nav.calls.push(`replace ${href}`),
    navigate: (href: string) => nav.calls.push(`navigate ${href}`),
    dismissTo: (href: string) => nav.calls.push(`dismissTo ${href}`),
    push: (href: { pathname: string }) => nav.calls.push(`push ${href.pathname}`),
  },
  useNavigation: () => ({ isFocused: () => nav.focused }),
  useNavigationContainerRef: () => ({}),
  useSegments: () => nav.segments,
}));
vi.mock('@/hooks/use-catalog-detail', () => ({ prefetchCatalogDetail: vi.fn() }));

import { useGoBack, useGoToTab } from '@/hooks/use-app-navigation';
import { useOpenItemDetail } from '@/utils/nav';

/** Render `hook` once and hand back what it returned. */
function run<T>(hook: () => T): T {
  let value!: T;
  function Probe() {
    value = hook();
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return value;
}

beforeEach(() => {
  nav.calls = [];
  nav.focused = true;
  nav.canGoBack = true;
  nav.segments = [];
});

describe('useGoBack', () => {
  test('a double tap on Back goes back once', () => {
    const goBack = run(() => useGoBack('/profile'));
    goBack();
    goBack();
    expect(nav.calls).toEqual(['back']);
  });

  test('a tap on a screen that is already leaving does nothing', () => {
    nav.focused = false;
    run(() => useGoBack('/profile'))();
    expect(nav.calls).toEqual([]);
  });

  test('with nothing to go back to it opens the fallback', () => {
    nav.canGoBack = false;
    run(() => useGoBack('/profile'))();
    expect(nav.calls).toEqual(['replace /profile']);
  });
});

describe('useGoToTab', () => {
  test('inside the tabs it switches tab', () => {
    nav.segments = ['(tabs)', '(explore)', 'item-detail'];
    run(() => useGoToTab())('/cart');
    expect(nav.calls).toEqual(['navigate /cart']);
  });

  test('from a root-stack screen it pops back to the tabs instead of stacking new ones', () => {
    nav.segments = ['track-order'];
    run(() => useGoToTab())('/explore');
    expect(nav.calls).toEqual(['dismissTo /explore']);
  });
});

describe('useOpenItemDetail', () => {
  test.each([
    [['(tabs)', '(explore)', 'category'], '/item-detail/[id]'],
    [['(tabs)', '(ai-chat)', 'chat-item', '[id]'], '/chat-item/[id]'],
    [['(tabs)', '(garage)', 'garage-parts'], '/garage-item/[id]'],
    [['liked'], '/item-detail/[id]'],
  ])('from %j opens %s', (segments, pathname) => {
    nav.segments = segments;
    run(() => useOpenItemDetail())('part-1');
    expect(nav.calls).toEqual([`push ${pathname}`]);
  });
});
