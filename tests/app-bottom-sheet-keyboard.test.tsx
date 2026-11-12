/**
 * A tall sheet stays below the status bar / Dynamic Island while the keyboard
 * is up (physical iPhone report: the address form's first field slid under the
 * status bar). The keyboard-avoiding wrapper lifts the sheet by the keyboard's
 * height, so the sheet itself has to give that height back.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, keyboard } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  keyboard: { handlers: new Map<string, (e?: any) => void>() },
}));

const SCREEN = 874; // iPhone 16 Pro
const TOP_INSET = 62;
const KEYBOARD = 336;

vi.mock('react-native', () => {
  const value = () => ({ setValue: () => {} });
  return {
    Animated: {
      Value: function Value() {
        return value();
      },
      spring: () => ({ start: () => {} }),
      timing: () => ({ start: () => {} }),
      View: host('animated-view'),
    },
    Dimensions: { get: () => ({ height: SCREEN, width: 402 }) },
    Keyboard: {
      addListener: (event: string, cb: (e?: any) => void) => {
        keyboard.handlers.set(event, cb);
        return { remove: () => keyboard.handlers.delete(event) };
      },
    },
    KeyboardAvoidingView: host('kav'),
    Modal: host('modal'),
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Platform: { OS: 'ios' },
    Pressable: host('pressable'),
    StyleSheet: { create: <T,>(s: T) => s },
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: TOP_INSET, bottom: 34, left: 0, right: 0 }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/shared/app-view', () => ({ AppView: host('view') }));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: { gray300: '#ccc' }, scheme: 'dark' }),
}));

const { AppBottomSheet } = await import('@/components/shared/app-bottom-sheet');

let tree: ReactTestRenderer;
afterEach(() => act(() => tree.unmount()));

function sheetStyle() {
  // The panel is the first AppView under the animated wrapper.
  const panel = tree.root.find((n) => String(n.type) === 'animated-view').children[0];
  return (panel as unknown as { props: { style: Record<string, number> } }).props.style;
}

describe('AppBottomSheet under the keyboard', () => {
  test('a fixed 0.8 sheet shrinks to the room between status bar and keyboard', () => {
    act(() => {
      tree = create(
        <AppBottomSheet visible onClose={() => {}} expandable={false} heightFraction={0.8} />,
      );
    });
    expect(sheetStyle().height).toBe(Math.round(SCREEN * 0.8));
    expect(sheetStyle().paddingBottom).toBe(34);

    act(() =>
      keyboard.handlers.get('keyboardWillChangeFrame')!({
        endCoordinates: { screenY: SCREEN - KEYBOARD },
      }),
    );
    const height = sheetStyle().height;
    // Sheet bottom sits on the keyboard; its top must clear the status bar.
    expect(SCREEN - KEYBOARD - height).toBeGreaterThanOrEqual(TOP_INSET);
    expect(sheetStyle().paddingBottom).toBeLessThan(34);

    act(() => keyboard.handlers.get('keyboardWillHide')!());
    expect(sheetStyle().height).toBe(Math.round(SCREEN * 0.8));
  });

  test('an expandable sheet is capped the same way', () => {
    act(() => {
      tree = create(<AppBottomSheet visible onClose={() => {}} heightFraction={1} />);
    });
    expect(SCREEN - sheetStyle().maxHeight).toBeGreaterThanOrEqual(TOP_INSET);
    act(() =>
      keyboard.handlers.get('keyboardWillChangeFrame')!({
        endCoordinates: { screenY: SCREEN - KEYBOARD },
      }),
    );
    expect(SCREEN - KEYBOARD - sheetStyle().maxHeight).toBeGreaterThanOrEqual(TOP_INSET);
  });

  test('a keyboard frame at the screen foot counts as hidden', () => {
    act(() => {
      tree = create(
        <AppBottomSheet visible onClose={() => {}} expandable={false} heightFraction={0.8} />,
      );
    });
    act(() =>
      keyboard.handlers.get('keyboardWillChangeFrame')!({ endCoordinates: { screenY: SCREEN } }),
    );
    expect(sheetStyle().height).toBe(Math.round(SCREEN * 0.8));
  });
});
