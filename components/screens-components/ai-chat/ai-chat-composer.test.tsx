import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, env } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  env: { fontScale: 1 },
}));

vi.mock('react-native', () => ({
  TextInput: host('input'),
  useWindowDimensions: () => ({ fontScale: env.fontScale }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('lucide-react-native', () => ({
  SendHorizontal: host('send-icon'),
  Square: host('stop-icon'),
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({
    tokens: {
      brand: 'teal',
      onBrand: 'on-teal',
      error: 'red',
      disabledBg: 'gray-bg',
      disabledFg: 'gray-fg',
      border: 'border',
      card: 'card',
      text: 'text',
      textMuted: 'muted',
    },
  }),
}));

import AiChatComposer from './ai-chat-composer';

function render(props: Partial<React.ComponentProps<typeof AiChatComposer>> = {}) {
  const handlers = { onChangeText: vi.fn(), onSend: vi.fn(), onEmptyTap: vi.fn(), onStop: vi.fn() };
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<AiChatComposer value="" {...handlers} {...props} />);
  });
  const input = () => r.root.find((n) => (n.type as unknown) === 'input');
  const send = () =>
    r.root.find((n) => (n.type as unknown) === 'pressable' && n.props.testID === 'chat-composer-send');
  const circle = () => send().find((n) => (n.type as unknown) === 'view').props.style;
  const frame = () => r.root.find((n) => (n.type as unknown) === 'view' && n.props.rounded === 16);
  return { ...handlers, input, send, circle, frame };
}

describe('send button', () => {
  test('is 48 by 48 with no slop reaching into the text', () => {
    const { send } = render();
    expect(send().props.style).toMatchObject({ width: 48, height: 48 });
    expect(send().props.hitSlop).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  test('empty: gray, and a tap does not send', () => {
    const { send, circle, onSend, onEmptyTap } = render();
    expect(circle().backgroundColor).toBe('gray-bg');
    send().props.onPress();
    expect(onSend).not.toHaveBeenCalled();
    expect(onEmptyTap).toHaveBeenCalledTimes(1);
  });

  test('only spaces count as empty', () => {
    const { circle } = render({ value: '   \n ' });
    expect(circle().backgroundColor).toBe('gray-bg');
  });

  test('with text: teal, and a tap sends', () => {
    const { send, circle, onSend } = render({ value: 'радиатор' });
    expect(circle().backgroundColor).toBe('teal');
    send().props.onPress();
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  test('while sending it stops instead, so a second send is impossible', () => {
    const { send, onSend, onStop } = render({ value: 'радиатор', isSending: true });
    send().props.onPress();
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  test('sits at the bottom of the frame for multiline text', () => {
    expect(render().frame().props.align).toBe('flex-end');
  });
});

describe('input', () => {
  test('is multiline, 16 units, with a teal cursor', () => {
    const { input } = render();
    expect(input().props.multiline).toBe(true);
    expect(input().props.style.fontSize).toBe(16);
    expect(input().props.cursorColor).toBe('teal');
    expect(input().props.selectionColor).toBe('teal');
  });

  test('never cuts pasted text', () => {
    expect(render().input().props.maxLength).toBeUndefined();
  });

  test('keeps the draft while sending', () => {
    const { input } = render({ value: 'следующий вопрос', isSending: true });
    expect(input().props.value).toBe('следующий вопрос');
    expect(input().props.editable).not.toBe(false);
  });

  test('stops growing at four lines, allowing for text size', () => {
    const height = () => render().input().props.style.maxHeight;
    expect(height()).toBe(114);
    env.fontScale = 2;
    expect(height()).toBe(202);
    env.fontScale = 1;
  });

  test('the border turns teal on focus and back on blur', () => {
    const { input, frame } = render();
    expect(frame().props.borderColor).toBe('border');
    act(() => input().props.onFocus());
    expect(frame().props.borderColor).toBe('teal80');
    act(() => input().props.onBlur());
    expect(frame().props.borderColor).toBe('border');
  });
});
