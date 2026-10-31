/**
 * AppButton regression matrix for the label-typography fix.
 *
 * The fix makes every AppButton label use its size's design-system variant
 * (`button` / `buttonSm`) in SemiBold instead of falling through to AppText's
 * `body` (Inter Regular, 24px line height). It touches ~74 call sites, so this
 * renders the REAL AppButton — real `useButtonStyles`, real theme tokens — and
 * pins, for every size / kind / variant / state in use:
 *
 *   - what changed: face, line height, lg font size, centred wrapping;
 *   - what must NOT change: font size of xs/sm/md, padding, radius, and every
 *     colour (fill, label, border, disabled) in both themes.
 */
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// React Native's global; AppButton's dev-only a11y warning reads it.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const { host, theme } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  theme: { scheme: 'dark' as 'light' | 'dark' },
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
  Platform: { OS: 'ios' },
}));
vi.mock('expo-router', () => ({ DarkTheme: { colors: {} }, DefaultTheme: { colors: {} } }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('@/components/shared/app-view', () => ({ AppView: host('view') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-icon', () => ({ AppIcon: host('icon') }));
vi.mock('@/contexts/theme.context', async () => {
  const { darkTokens, lightTokens } = await import('@/themes');
  return {
    useThemeContext: () => ({
      scheme: theme.scheme,
      tokens: theme.scheme === 'dark' ? darkTokens : lightTokens,
    }),
  };
});

import {
  darkTokens,
  getTextStyle,
  getWeightStyle,
  lightTokens,
  type TextVariant,
  type WeightName,
} from '@/themes';
import { AppButton, type AppButtonProps, type ButtonSize } from './app-button';

type Flat = Record<string, unknown>;
const flat = (style: unknown): Flat =>
  Array.isArray(style)
    ? Object.assign({}, ...style.flat(Infinity).filter(Boolean))
    : ((style as Flat) ?? {});

function render(props: AppButtonProps, scheme: 'light' | 'dark' = 'dark') {
  theme.scheme = scheme;
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<AppButton title="Label" {...props} />);
  });
  const pressable = r.root.find((n) => (n.type as string) === 'pressable');
  const labels = r.root.findAll((n) => n.type === 'text');
  const label: ReactTestInstance | undefined = labels[0];
  const content = r.root.find(
    (n) => n.type === 'view' && flat(n.props.style).paddingVertical !== undefined,
  );
  const labelStyle = label ? flat(label.props.style) : {};
  const variant = label?.props.textVariant as TextVariant | undefined;
  const weight = label?.props.weight as WeightName | undefined;
  const pad = flat(content.props.style);
  const lineHeight = variant ? getTextStyle(variant).lineHeight! : 0;
  return {
    hasLabel: !!label,
    variant,
    face: weight ? getWeightStyle(weight).fontFamily : undefined,
    fontSize: labelStyle.fontSize,
    lineHeight,
    labelColor: labelStyle.color,
    align: label?.props.align,
    numberOfLines: label?.props.numberOfLines,
    box: flat(pressable.props.style),
    paddingVertical: pad.paddingVertical as number,
    paddingHorizontal: pad.paddingHorizontal as number,
    /** One-line height: vertical padding + the label's line height. */
    height: (pad.paddingVertical as number) * 2 + lineHeight,
  };
}

describe('typography per size (what changed)', () => {
  // Before: Inter Regular, line height 24 (AppText `body`), lg at 18px, so
  // heights were xs 36 · sm 40 · md 44 · lg 52.
  test.each([
    ['xs', 12, 18, 30],
    ['sm', 14, 18, 34],
    ['md', 16, 20, 40],
    ['lg', 16, 20, 48],
  ] as const)('%s → SemiBold %ipx / %ipx line, %ipx tall', (size, fontSize, lineHeight, height) => {
    const b = render({ size: size as ButtonSize, kind: 'brand' });
    expect(b.face).toBe('Figtree_600SemiBold');
    expect(b.fontSize).toBe(fontSize);
    expect(b.lineHeight).toBe(lineHeight);
    expect(b.height).toBe(height);
  });

  test('dense sizes keep their font size — only the face and line height change', () => {
    expect(render({ size: 'xs' }).fontSize).toBe(12);
    expect(render({ size: 'sm' }).fontSize).toBe(14);
    expect(render({ size: 'md' }).fontSize).toBe(16);
  });

  test.each(['xs', 'sm', 'md', 'lg'] as const)('%s keeps its padding and radius', (size) => {
    const pads = { xs: [6, 10], sm: [8, 12], md: [10, 16], lg: [14, 18] }[size];
    const b = render({ size });
    expect([b.paddingVertical, b.paddingHorizontal]).toEqual(pads);
    expect(b.box.borderRadius).toBe(12);
  });
});

describe('multiline labels', () => {
  test('a long label wraps (never truncated) and stays centred', () => {
    const b = render({ size: 'lg', title: 'Сделать активным автомобилем' });
    expect(b.numberOfLines).toBeUndefined();
    expect(b.align).toBe('center');
    // Two lines are 28 + 2 × 20 = 68px now, 28 + 2 × 24 = 76px before.
    expect(b.paddingVertical * 2 + 2 * b.lineHeight).toBe(68);
  });

  test('a caller-set numberOfLines is still honoured', () => {
    expect(render({ size: 'sm', numberOfLines: 1 }).numberOfLines).toBe(1);
  });
});

describe('colours are untouched (both themes)', () => {
  const cases = [
    // [kind, variant, fill, label, border]
    ['brand', 'solid', 'brandBg', 'onBrand', null],
    ['primary', 'solid', 'primaryBg', 'onPrimary', null],
    ['secondary', 'solid', 'secondaryBg', 'onSecondary', null],
    ['error', 'solid', 'error', 'white', null], // destructive
    ['secondary', 'outline', null, 'secondary', 'secondary'],
    ['text', 'ghost', null, 'text', null],
  ] as const;

  for (const scheme of ['light', 'dark'] as const) {
    const tokens = scheme === 'dark' ? darkTokens : lightTokens;
    test.each(cases)(`${scheme}: %s / %s`, (kind, variant, fill, label, border) => {
      const b = render({ kind, variant, size: 'md' }, scheme);
      expect(b.box.backgroundColor).toBe(fill ? tokens[fill] : 'transparent');
      expect(b.labelColor).toBe(tokens[label]);
      if (border) {
        expect(b.box.borderWidth).toBe(1);
        expect(b.box.borderColor).toBe(tokens[border]);
      }
      expect(b.box.opacity).toBe(1);
      // Typography is the same whatever the kind.
      expect(b.face).toBe('Figtree_600SemiBold');
    });

    test(`${scheme}: disabled keeps its greyed fill, label and opacity`, () => {
      const b = render({ kind: 'brand', size: 'lg', disabled: true }, scheme);
      expect(b.box.backgroundColor).toBe(tokens.disabledBg);
      expect(b.labelColor).toBe(tokens.disabledFg);
      expect(b.box.opacity).toBe(0.6);
      expect(b.face).toBe('Figtree_600SemiBold');
    });
  }
});

describe('buttons without a text label', () => {
  test('an icon-only / children button gets no injected label', () => {
    const b = render({
      title: '',
      size: 'xs',
      variant: 'ghost',
      kind: 'text',
      accessibilityLabel: 'x',
    });
    expect(b.hasLabel).toBe(false);
  });
});
