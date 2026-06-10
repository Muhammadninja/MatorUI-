import { DarkTheme, DefaultTheme } from 'expo-router';
import type { TextStyle, ViewStyle } from 'react-native';

import type { ThemeTokens } from './types';

export type FontFamilyName = 'default' | 'heading' | 'accent' | 'mono';
export type WeightName = 'regular' | 'medium' | 'semibold' | 'bold';
export type TextVariant =
  | 'body'
  | 'bodySm'
  | 'bodyXs'
  | 'bodySemibold'
  | 'h3'
  | 'h4'
  | 'button'
  | 'buttonSm'
  | 'caption'
  | 'subtitle'
  | 'title';
export type ShadowLevel = 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12;
export type ColorName = keyof ThemeTokens;

/**
 * Spacing scale. Eight rungs cover the entire app's spacing needs and
 * line up with a 4-pixel grid. AppView's `px/py/p/m/gap/...` props accept
 * either a `SpacingKey` (e.g. `px="md"`) or a raw number for one-offs.
 *
 * Why a scale: drift. Without one, half the screens used `px={16}`,
 * some used `px={14}`, the new-address form used `px={10}`. With a scale,
 * consumers commit to `md` / `sm` / `lg` and visual rhythm is enforced.
 */
export const SPACING = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export type SpacingKey = keyof typeof SPACING;

/** Coerce either a scale key (`"md"`) or a number to a pixel value. */
export function resolveSpace(value: number | SpacingKey | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return SPACING[value];
}

export const APP_FONTS: Record<FontFamilyName, string | undefined> = {
  default: 'Montserrat_400Regular',
  heading: 'SpaceGrotesk_700Bold',
  accent: 'Manrope_600SemiBold',
  mono: 'SpaceMono',
};

export const FONT_PACKAGES = {
  body: {
    regular: 'Montserrat_400Regular',
    medium: 'Montserrat_500Medium',
    semibold: 'Montserrat_600SemiBold',
    bold: 'Montserrat_700Bold',
  },
  heading: {
    bold: 'SpaceGrotesk_700Bold',
  },
  accent: {
    semibold: 'Manrope_600SemiBold',
  },
  mono: {
    regular: 'SpaceMono',
  },
} as const;

const textVariants: Record<TextVariant, TextStyle> = {
  body: { fontSize: 16, lineHeight: 24, fontFamily: 'Montserrat_400Regular' },
  bodySm: { fontSize: 14, lineHeight: 20, fontFamily: 'Montserrat_400Regular' },
  bodyXs: { fontSize: 12, lineHeight: 16, fontFamily: 'Montserrat_400Regular' },
  bodySemibold: { fontSize: 15, lineHeight: 22, fontFamily: 'Montserrat_600SemiBold' },
  h3: { fontSize: 24, lineHeight: 30, fontFamily: 'SpaceGrotesk_700Bold' },
  h4: { fontSize: 20, lineHeight: 26, fontFamily: 'SpaceGrotesk_700Bold' },
  button: { fontSize: 16, lineHeight: 20, fontFamily: 'Manrope_600SemiBold' },
  buttonSm: { fontSize: 14, lineHeight: 18, fontFamily: 'Manrope_600SemiBold' },
  caption: { fontSize: 11, lineHeight: 14, fontFamily: 'Montserrat_400Regular' },
  subtitle: { fontSize: 18, lineHeight: 24, fontFamily: 'Manrope_600SemiBold' },
  title: { fontSize: 28, lineHeight: 34, fontFamily: 'SpaceGrotesk_700Bold' },
};

const weightStyles: Record<WeightName, TextStyle> = {
  regular: { fontFamily: 'Montserrat_400Regular', fontWeight: '400' },
  medium: { fontFamily: 'Montserrat_500Medium', fontWeight: '500' },
  semibold: { fontFamily: 'Montserrat_600SemiBold', fontWeight: '600' },
  bold: { fontFamily: 'Montserrat_700Bold', fontWeight: '700' },
};

export const lightTokens: ThemeTokens = {
  background: '#ffffff',
  backgroundSecondary: '#f3f3f3',
  surface: '#ffffff',
  card: '#fafafa',
  onCard: '#050505',
  text: '#050505',
  onBackground: '#050505',
  border: '#d6d6d6',
  divider: '#ececec',
  overlay: 'rgba(5, 5, 5, 0.12)',
  primary: '#ffffff',
  primaryBg: '#ffffff',
  primaryPressed: '#f2f2f2',
  onPrimary: '#000000',
  secondary: '#000000',
  secondaryBg: '#000000',
  secondaryPressed: '#1a1a1a',
  onSecondary: '#ffffff',
  brand: '#000000',
  brandBg: '#000000',
  brandPressed: '#1a1a1a',
  onBrand: '#ffffff',
  success: '#0f9d58',
  successPressed: '#0b7e46',
  warning: '#f4b400',
  warningPressed: '#d89f00',
  error: '#db4437',
  errorPressed: '#b9362b',
  info: '#4285f4',
  infoPressed: '#2f6fda',
  disabledBg: '#eeeeee',
  disabledFg: '#8f8f8f',
  outlinePressedOverlay: 'rgba(0, 0, 0, 0.05)',
  ghostPressedOverlay: 'rgba(0, 0, 0, 0.04)',
  linkPressedOverlay: 'rgba(0, 0, 0, 0.08)',
  switchTrackOff: '#d1d1d1',
  switchTrackOn: '#000000',
  switchThumbOn: '#ffffff',
  listPressedOverlay: 'rgba(0, 0, 0, 0.04)',
  textPressed: '#161616',
  icon: '#050505',
  gray50: '#fafafa',
  gray100: '#f1f1f1',
  gray200: '#e2e2e2',
  gray300: '#cfcfcf',
  gray400: '#9a9a9a',
  white: '#ffffff',
  black: '#000000',
  rating: '#F59E0B',
  accolade: '#f4c542',
  value: '#4ade80',
  scrim: 'rgba(0, 0, 0, 0.55)',
};

export const darkTokens: ThemeTokens = {
  background: '#050505',
  backgroundSecondary: '#121212',
  surface: '#0a0a0a',
  card: '#111111',
  onCard: '#ffffff',
  text: '#ffffff',
  onBackground: '#ffffff',
  border: '#2a2a2a',
  divider: '#1c1c1c',
  overlay: 'rgba(255, 255, 255, 0.14)',
  primary: '#ffffff',
  primaryBg: '#ffffff',
  primaryPressed: '#ececec',
  onPrimary: '#000000',
  secondary: '#ffffff',
  secondaryBg: '#ffffff',
  secondaryPressed: '#e5e5e5',
  onSecondary: '#000000',
  brand: '#ffffff',
  brandBg: '#ffffff',
  brandPressed: '#e5e5e5',
  onBrand: '#000000',
  success: '#22c55e',
  successPressed: '#16a34a',
  warning: '#fbbc05',
  warningPressed: '#e2a700',
  error: '#ff6b5f',
  errorPressed: '#db4437',
  info: '#8ab4f8',
  infoPressed: '#669df6',
  disabledBg: '#1a1a1a',
  disabledFg: '#6e6e6e',
  outlinePressedOverlay: 'rgba(255, 255, 255, 0.08)',
  ghostPressedOverlay: 'rgba(255, 255, 255, 0.06)',
  linkPressedOverlay: 'rgba(255, 255, 255, 0.10)',
  switchTrackOff: '#3a3a3a',
  switchTrackOn: '#ffffff',
  switchThumbOn: '#ffffff',
  listPressedOverlay: 'rgba(255, 255, 255, 0.05)',
  textPressed: '#f2f2f2',
  icon: '#ffffff',
  gray50: '#0e0e0e',
  gray100: '#171717',
  gray200: '#262626',
  gray300: '#404040',
  gray400: '#737373',
  white: '#ffffff',
  black: '#000000',
  rating: '#F59E0B',
  accolade: '#b8860b',
  value: '#15803d',
  scrim: 'rgba(0, 0, 0, 0.55)',
};

export function createNavigationTheme(scheme: 'light' | 'dark') {
  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const tokens = scheme === 'dark' ? darkTokens : lightTokens;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: tokens.primary,
      background: tokens.background,
      card: tokens.card,
      text: tokens.text,
      border: tokens.border,
      notification: tokens.info,
    },
  };
}

export function getTextStyle(
  variant: TextVariant = 'body',
  family: FontFamilyName = 'default',
): TextStyle {
  return {
    ...textVariants[variant],
    ...(APP_FONTS[family] ? { fontFamily: APP_FONTS[family] } : null),
  };
}

export function getWeightStyle(weight: WeightName): TextStyle {
  return weightStyles[weight];
}

export function getShadowStyle(level: ShadowLevel = 1, tokens?: ThemeTokens): ViewStyle {
  if (!level) return {};
  const opacity = Math.min(0.12 + level * 0.02, 0.32);
  return {
    shadowColor: tokens?.black ?? '#000000',
    shadowOpacity: opacity,
    shadowRadius: Math.max(2, level),
    shadowOffset: { width: 0, height: Math.max(1, Math.round(level / 2)) },
    elevation: level,
  };
}
