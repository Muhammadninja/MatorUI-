/**
 * Guest Profile → Log in.
 *
 * The button used to open an intermediate "Welcome to Mator" modal whose only
 * way forward was "Continue with phone". It now goes straight to where that
 * button went. This renders the REAL AppButton so the double-tap case runs the
 * real press handling: a route push, unlike opening a modal, is not idempotent.
 */
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// React Native's global; AppButton's dev-only a11y warning reads it.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const { host, push } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  push: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: { push },
  DarkTheme: { colors: {} },
  DefaultTheme: { colors: {} },
}));
vi.mock('react-native', () => ({
  Animated: {
    View: host('animated-view'),
    Value: class {
      constructor(public v: number) {}
    },
    spring: () => ({ start: () => {} }),
    timing: () => ({ start: () => {} }),
  },
  // Resolve the style callback the way Pressable does, unpressed.
  Pressable: ({
    children,
    style,
    ...p
  }: Record<string, unknown> & { children?: React.ReactNode; style?: unknown }) =>
    React.createElement(
      'pressable',
      { ...p, style: typeof style === 'function' ? style({ pressed: false }) : style },
      children,
    ),
  View: host('rn-view'),
  ActivityIndicator: host('spinner'),
  Platform: { OS: 'ios', select: (o: { ios?: unknown }) => o.ios },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('lucide-react-native', () => ({
  ChevronRight: host('icon'),
  LogIn: host('icon'),
  Settings: host('icon'),
  UserRound: host('icon'),
}));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable-view'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-icon', () => ({ AppIcon: host('icon') }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ guestId: 'AXFFC4' }) }));
vi.mock('@/contexts/theme.context', async () => {
  const { lightTokens } = await import('@/themes');
  return { useThemeContext: () => ({ scheme: 'light', tokens: lightTokens }) };
});

import { modalService } from '@/services/global-modal-service/global-modal.service';
import ProfileGuestEmpty from './profile-guest-empty';

function render(): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<ProfileGuestEmpty />);
  });
  return r;
}

const logInButton = (r: ReactTestRenderer): ReactTestInstance =>
  r.root.find(
    (n) =>
      (n.type as unknown) === 'pressable' &&
      n.props.accessibilityLabel === 'profileCards.logInToAccount',
  );

const tap = (node: ReactTestInstance) =>
  act(() => {
    (node.props.onPress as (e: object) => void)({});
  });

describe('Guest Profile → Log in', () => {
  const openModal = vi.spyOn(modalService, 'openModal');

  beforeEach(() => {
    vi.useFakeTimers();
    push.mockClear();
    openModal.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('goes straight to the phone sheet, where "Continue with phone" went', () => {
    tap(logInButton(render()));

    // The modal built this from its `redirectTo: '/profile'`.
    expect(push.mock.calls).toEqual([[`/sign-in?next=${encodeURIComponent('/profile')}`]]);
    expect(openModal).not.toHaveBeenCalled();
  });

  test('a double tap opens one sheet, and the button works again after it closes', () => {
    const r = render();
    tap(logInButton(r));
    tap(logInButton(r));
    expect(push).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    tap(logInButton(r));
    expect(push).toHaveBeenCalledTimes(2);
  });
});
