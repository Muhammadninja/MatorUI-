/**
 * AppButton label typography.
 *
 * Regression: `SIZE_MAP` declares each size's design-system text variant
 * (`button` / `buttonSm`) and `useButtonStyles` computes it, but AppButton
 * never passed it on. With no variant the label fell through to AppText's
 * `body` default — Inter Regular, 24px line height — so every button's label
 * rendered thin, and a two-line label ("Сделать активным автомобилем" at 18px)
 * became an oversized block. `ButtonContent` now requires the default variant,
 * so the compiler enforces that AppButton wires it.
 */
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

vi.mock('react-native', () => ({ ActivityIndicator: host('spinner') }));
vi.mock('expo-router', () => ({ DarkTheme: { colors: {} }, DefaultTheme: { colors: {} } }));
vi.mock('@/components/shared/app-view', () => ({ AppView: host('view') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-icon', () => ({ AppIcon: host('icon') }));

import { getTextStyle, getWeightStyle, type TextVariant, type WeightName } from '@/themes';
import { ButtonContent } from './button-content';
import { SIZE_MAP } from './tokens';
import type { ButtonSize } from './app-button';

function label(size: ButtonSize, textVariant?: TextVariant, weight?: WeightName) {
  const { font, textVariant: defaultTextVariant } = SIZE_MAP[size];
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <ButtonContent
        title="Сделать активным автомобилем"
        showLoading={false}
        loadingVariant="replace"
        contentContainerStyle={{}}
        labelBaseStyle={{ color: '#fff' }}
        textVariant={textVariant}
        defaultTextVariant={defaultTextVariant}
        weight={weight}
        resolvedIconColor="#fff"
        iconSize={20}
        fontSize={font}
        spinnerSize="large"
      />,
    );
  });
  const text = r.root.find((n) => n.type === 'text');
  const style = Object.assign({}, ...(text.props.style as object[]).filter(Boolean)) as {
    fontSize?: number;
  };
  const labelWeight = text.props.weight as WeightName | undefined;
  // AppText's own precedence: the variant (with the default Regular family
  // laid over it), then the weight's face on top.
  const face = labelWeight
    ? getWeightStyle(labelWeight).fontFamily
    : getTextStyle(text.props.textVariant).fontFamily;
  return {
    variant: text.props.textVariant as TextVariant,
    weight: labelWeight,
    face,
    style,
    align: text.props.align,
  };
}

describe('AppButton label typography', () => {
  test.each(['md', 'lg'] as const)('%s uses the design-system `button` variant', (size) => {
    const { variant, face, style } = label(size);
    expect(variant).toBe('button');
    // Tight line height from the variant, SemiBold face from the weight…
    expect(getTextStyle(variant).lineHeight).toBe(20);
    expect(face).toBe('Figtree_600SemiBold');
    // …and the size is the variant's own 16px.
    expect(style.fontSize).toBe(16);
  });

  test.each(['xs', 'sm'] as const)('%s uses the `buttonSm` variant', (size) => {
    expect(label(size).variant).toBe('buttonSm');
  });

  test('never falls back to the Regular `body` face', () => {
    for (const size of Object.keys(SIZE_MAP) as ButtonSize[]) {
      const { variant, face } = label(size);
      expect(variant, size).not.toBe('body');
      expect(face, size).toBe('Figtree_600SemiBold');
    }
  });

  test('a caller-chosen variant still wins, with its own size', () => {
    const { variant, style } = label('lg', 'caption');
    expect(variant).toBe('caption');
    expect(style.fontSize).toBeUndefined();
  });

  test('a caller-chosen weight still wins', () => {
    expect(label('lg', undefined, 'bold').face).toBe('Figtree_700Bold');
  });

  test('a wrapped label is centred in a centred button', () => {
    expect(label('lg').align).toBe('center');
  });

  test('lg matches the `button` variant size instead of 18px', () => {
    expect(SIZE_MAP.lg.font).toBe(getTextStyle('button').fontSize);
  });
});
