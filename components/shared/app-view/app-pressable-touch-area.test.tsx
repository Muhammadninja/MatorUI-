import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));

vi.mock('react-native', () => ({
  Animated: {
    Value: class {
      interpolate() {
        return 0;
      }
    },
    View: host('wrapper'),
    timing: () => ({ start: () => {} }),
  },
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
  Pressable: host('touch'),
  StyleSheet: {
    create: <T,>(s: T) => s,
    flatten: (s: unknown) => Object.assign({}, ...[s].flat(3).filter(Boolean)),
    hairlineWidth: 1,
  },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/themes', () => ({ getShadowStyle: () => ({}) }));
vi.mock('./style-compose', () => ({
  composeBorder: () => ({}),
  composeFlexbox: () => ({}),
  composeRounding: () => ({}),
  composeSpacing: () => ({}),
}));
vi.mock('./safe-area', () => ({ composeSafeAreaPadding: () => ({}) }));
vi.mock('./colors', () => ({
  useColorToken: () => undefined,
  useResolvedBackgroundColor: () => undefined,
}));

import { AppPressableView } from './app-pressable-view';

function touchStyle(element: React.ReactElement) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(element);
  });
  const touch = r.root.find((n) => (n.type as unknown) === 'touch');
  const resolved = (touch.props.style as (s: { pressed: boolean }) => unknown)({ pressed: false });
  return Object.assign({}, ...[resolved].flat(3).filter(Boolean)) as Record<string, unknown>;
}

const FILLS = { alignSelf: 'stretch', flexGrow: 1 };

describe('touch area', () => {
  test.each([
    ['width and height', { width: 48, height: 48 }],
    ['a minimum height', { minHeight: 48 }],
    ['a style array', [{ width: 48 }, { height: 48 }]],
  ])('fills a wrapper with %s', (_name, style) => {
    expect(touchStyle(<AppPressableView center style={style} />)).toMatchObject(FILLS);
  });

  test.each([
    ['no style', undefined],
    ['spacing only', { marginTop: 4 }],
  ])('still hugs its content with %s', (_name, style) => {
    expect(touchStyle(<AppPressableView style={style} />).flexGrow).toBeUndefined();
  });
});
