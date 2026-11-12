import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, a11y, timing } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  a11y: {
    announceForAccessibility: vi.fn(),
    isReduceMotionEnabled: vi.fn(async () => false),
    addEventListener: vi.fn(() => ({ remove: () => {} })),
  },
  timing: vi.fn(() => ({})),
}));

vi.mock('react-native', () => ({
  AccessibilityInfo: a11y,
  Animated: {
    Value: class {
      setValue() {}
    },
    View: host('animated-view'),
    timing,
    // Exits report finished at once, so a dismissal lands within the test.
    parallel: () => ({
      start: (done?: (r: { finished: boolean }) => void) => done?.({ finished: true }),
    }),
  },
  Easing: { out: () => () => 0, cubic: () => 0 },
  Pressable: host('pressable'),
  StyleSheet: { create: <T,>(s: T) => s },
  View: host('rn-view'),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('lucide-react-native', () => ({
  Check: host('icon-check'),
  Info: host('icon-info'),
  TriangleAlert: host('icon-warning'),
  X: host('icon-x'),
  XCircle: host('icon-error'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({
    tokens: {
      card: 'card',
      border: 'border',
      success: 'success',
      error: 'error',
      warning: 'warning',
      info: 'info',
      textMuted: 'muted',
      brand: 'brand',
    },
  }),
}));

import { toastService } from '@/services/toast-service';
import AppToastHost from './app-toast-host';

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(3).filter(Boolean));

const is = (n: ReactTestInstance, type: string) => (n.type as unknown) === type;

// The service is a singleton, so a host left mounted keeps reacting to later tests.
let mounted: ReactTestRenderer | undefined;

async function renderHost() {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<AppToastHost />);
  });
  mounted = r;
  return r;
}

const texts = (r: ReactTestRenderer) =>
  r.root.findAll((n) => is(n, 'text')).map((n) => n.props.children as string);

async function setReduceMotion(on: boolean) {
  a11y.isReduceMotionEnabled.mockResolvedValue(on);
}

beforeEach(() => {
  vi.useFakeTimers();
  a11y.announceForAccessibility.mockClear();
  timing.mockClear();
  void setReduceMotion(false);
  toastService.dismissAll();
});

afterEach(async () => {
  await act(async () => {
    mounted?.unmount();
  });
  mounted = undefined;
  vi.useRealTimers();
});

describe('appearance', () => {
  test.each([
    ['success', 'icon-check', 'success'],
    ['danger', 'icon-error', 'error'],
    ['warning', 'icon-warning', 'warning'],
    ['info', 'icon-info', 'info'],
  ] as const)('%s uses its own icon and colour', async (kind, icon, color) => {
    const r = await renderHost();
    await act(async () => {
      toastService.show({ kind, title: 'x' });
    });
    expect(r.root.find((n) => is(n, icon)).props.color).toBe(color);
  });

  test('the card is opaque, content-sized, and the close button is 48 units', async () => {
    const r = await renderHost();
    await act(async () => {
      toastService.success('x');
    });
    const card = flat(r.root.find((n) => n.props.testID === 'app-toast').props.style);
    expect(card).toMatchObject({
      backgroundColor: 'card',
      borderColor: 'border',
      borderRadius: 12,
    });
    expect(card.height).toBeUndefined();

    const close = r.root.find(
      (n) => is(n, 'pressable') && n.props.accessibilityLabel === 'common.dismiss',
    );
    const style = flat(
      (close.props.style as (s: { pressed: boolean }) => unknown)({ pressed: false }),
    );
    expect(style).toMatchObject({ width: 48, height: 48 });
    expect(close.findByType('icon-x' as never).props.size).toBe(16);
  });

  test('never truncates the message', async () => {
    const r = await renderHost();
    await act(async () => {
      toastService.success('title', { description: 'description' });
    });
    for (const t of r.root.findAll((n) => is(n, 'text'))) {
      expect(t.props.numberOfLines).toBeUndefined();
    }
  });

  test('sits below the top safe area, over the page', async () => {
    const r = await renderHost();
    await act(async () => {
      toastService.success('x');
    });
    expect(flat(r.root.findAll((n) => is(n, 'rn-view'))[0].props.style)).toMatchObject({
      position: 'absolute',
      paddingTop: 52,
      paddingHorizontal: 16,
    });
  });
});

describe('timing', () => {
  test('success clears after about 3 seconds', async () => {
    const r = await renderHost();
    await act(async () => {
      toastService.success('x');
    });
    await act(async () => {
      vi.advanceTimersByTime(2900);
    });
    expect(texts(r)).toEqual(['x']);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(texts(r)).toEqual([]);
  });

  test('errors stay longer than success', async () => {
    const r = await renderHost();
    await act(async () => {
      toastService.danger('failed');
    });
    await act(async () => {
      vi.advanceTimersByTime(5900);
    });
    expect(texts(r)).toEqual(['failed']);
  });

  test('a toast with an action stays until dismissed', async () => {
    const r = await renderHost();
    await act(async () => {
      toastService.danger('failed', { actionLabel: 'retry', onAction: () => {} });
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(texts(r)).toContain('failed');
  });

  test('an explicit duration still wins', () => {
    const id = toastService.success('x', { duration: 1234 });
    let seen = 0;
    const off = toastService.subscribe((list) => {
      seen = list.find((t) => t.id === id)?.duration ?? 0;
    });
    off();
    expect(seen).toBe(1234);
  });
});

describe('rapid actions', () => {
  test('a new toast replaces the current one instead of stacking', async () => {
    const r = await renderHost();
    await act(async () => {
      toastService.success('one');
      toastService.success('two');
      toastService.danger('three');
    });
    expect(texts(r)).toEqual(['three']);
    expect(
      r.root.findAll((n) => is(n, 'pressable') && n.props.testID === 'app-toast'),
    ).toHaveLength(1);
  });

  test('a replacement gets its own full time on screen', async () => {
    const r = await renderHost();
    await act(async () => {
      toastService.success('one');
    });
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    await act(async () => {
      toastService.success('two');
    });
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(texts(r)).toEqual(['two']);
  });
});

describe('accessibility', () => {
  test('announces the message, with its description', async () => {
    await renderHost();
    await act(async () => {
      toastService.success('Saved', { description: 'Kia K5' });
    });
    expect(a11y.announceForAccessibility).toHaveBeenCalledExactlyOnceWith('Saved. Kia K5');
  });

  test('leaves the close button reachable by screen readers', async () => {
    const r = await renderHost();
    await act(async () => {
      toastService.success('x');
    });
    expect(r.root.find((n) => n.props.testID === 'app-toast').props.accessible).toBe(false);
  });

  test('reduced motion skips the animation', async () => {
    await setReduceMotion(true);
    const r = await renderHost();
    await act(async () => {
      toastService.success('x');
    });
    expect(timing).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(timing).not.toHaveBeenCalled();
    expect(texts(r)).toEqual([]);
  });
});
