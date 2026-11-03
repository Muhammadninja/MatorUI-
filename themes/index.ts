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

// Mator uses a single family — Inter — across every role (weights
// 400/500/600/700). The teal handoff keeps the existing font only if it supports
// Russian and Uzbek Latin reliably; Figtree has no Cyrillic and no `ʻ`, so Russian
// fell back to the system face mid-string. Inter covers both.
// The three "family" names (default/heading/accent) still exist so the ~1k
// existing `family=` call sites keep working; they now all resolve to an
// Inter weight. The MATOR wordmark is the one exception — it uses
// Raleway 800 (see `app-logo`).
export const APP_FONTS: Record<FontFamilyName, string | undefined> = {
  default: 'Inter_400Regular',
  heading: 'Inter_700Bold',
  accent: 'Inter_600SemiBold',
  mono: 'SpaceMono',
};

export const FONT_PACKAGES = {
  body: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  heading: {
    bold: 'Inter_700Bold',
  },
  accent: {
    semibold: 'Inter_600SemiBold',
  },
  mono: {
    regular: 'SpaceMono',
  },
} as const;

const textVariants: Record<TextVariant, TextStyle> = {
  body: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular' },
  bodySm: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  bodyXs: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  bodySemibold: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_600SemiBold' },
  h3: { fontSize: 24, lineHeight: 30, fontFamily: 'Inter_700Bold' },
  h4: { fontSize: 20, lineHeight: 26, fontFamily: 'Inter_700Bold' },
  button: { fontSize: 16, lineHeight: 20, fontFamily: 'Inter_600SemiBold' },
  buttonSm: { fontSize: 14, lineHeight: 18, fontFamily: 'Inter_600SemiBold' },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_500Medium' },
  subtitle: { fontSize: 18, lineHeight: 24, fontFamily: 'Inter_600SemiBold' },
  title: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold' },
};

const weightStyles: Record<WeightName, TextStyle> = {
  regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
  medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' },
  semibold: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
};

export const lightTokens: ThemeTokens = {
  background: '#F5F6F8',
  backgroundSecondary: '#EEF0F3',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  onCard: '#18181B',
  text: '#18181B',
  onBackground: '#18181B',
  textMuted: '#61616B',
  border: '#E2E4E9',
  controlBorder: '#858591',
  divider: '#E2E4E9',
  overlay: 'rgba(24, 24, 27, 0.12)',
  primary: '#FFFFFF',
  primaryBg: '#FFFFFF',
  primaryPressed: '#F5F6F8',
  onPrimary: '#18181B',
  secondary: '#18181B',
  // The `secondary` button: white, graphite label, visible outline. `secondary`
  // / `onSecondary` stay the graphite pair that badges and ribbons fill with.
  secondaryBg: '#FFFFFF',
  secondaryPressed: '#F5F6F8',
  onSecondary: '#FFFFFF',
  onSecondaryBg: '#18181B',
  secondaryBorder: '#858591',
  brand: '#007F86',
  brandText: '#00737A',
  brandBg: '#007F86',
  brandPressed: '#00666C',
  onBrand: '#FFFFFF',
  success: '#15803D',
  successPressed: '#166534',
  warning: '#92400E',
  warningPressed: '#78350F',
  error: '#B91C1C',
  errorPressed: '#991B1B',
  // The handoff has no blue: teal is the interaction colour, and links and
  // informational accents read through this token.
  info: '#007F86',
  infoPressed: '#00666C',
  disabledBg: '#E8E9ED',
  disabledFg: '#686874',
  outlinePressedOverlay: 'rgba(24, 24, 27, 0.05)',
  ghostPressedOverlay: 'rgba(24, 24, 27, 0.04)',
  linkPressedOverlay: 'rgba(24, 24, 27, 0.08)',
  switchTrackOff: '#d1d1d1',
  switchTrackOn: '#007F86',
  switchThumbOn: '#FFFFFF',
  listPressedOverlay: 'rgba(24, 24, 27, 0.04)',
  textPressed: '#27272A',
  icon: '#18181B',
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
  onValue: '#05310f',
  scrim: 'rgba(0, 0, 0, 0.55)',
  scannerAccent: '#00e676',
  brandSoft: '#E5F4F3',
  successSoft: '#DCFCE7',
  warningSoft: '#FEF3C7',
  errorSoft: '#FEE2E2',
  infoSoft: '#E5F4F3',
  // Garage card — graphite in light mode, with white type and a white CTA.
  hero: '#18181B',
  onHero: '#FFFFFF',
  heroMuted: 'rgba(255, 255, 255, 0.72)',
  heroDivider: 'rgba(255, 255, 255, 0.18)',
  heroWash: 'rgba(255, 255, 255, 0.16)',
  // Home's selected-vehicle banner: pale teal in light mode.
  vehicleBanner: '#E5F4F3',
  vehicleBannerBorder: '#C5E3E1',
  onVehicleBanner: '#18181B',
  vehicleBannerMuted: '#61616B',
};

export const darkTokens: ThemeTokens = {
  background: '#050505',
  backgroundSecondary: '#121212',
  surface: '#0a0a0a',
  card: '#111111',
  onCard: '#ffffff',
  text: '#ffffff',
  onBackground: '#ffffff',
  textMuted: '#8f8f8f',
  border: '#2a2a2a',
  controlBorder: '#737373',
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
  onSecondaryBg: '#000000',
  secondaryBorder: '#ffffff',
  brand: '#ffffff',
  brandText: '#ffffff',
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
  // Dark ON-track is white, so the thumb must be dark (mirrors the light
  // theme's black-track / white-thumb) — a white thumb here vanishes.
  switchThumbOn: '#050505',
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
  onValue: '#05310f',
  scrim: 'rgba(0, 0, 0, 0.55)',
  scannerAccent: '#00e676',
  brandSoft: 'rgba(255, 255, 255, 0.12)',
  // Dark-mode success/info are lighter (#22c55e / #8ab4f8); the tints run a
  // touch stronger so they still read against the near-black card.
  successSoft: 'rgba(34, 197, 94, 0.16)',
  infoSoft: 'rgba(138, 180, 248, 0.18)',
  warningSoft: 'rgba(251, 188, 5, 0.16)',
  errorSoft: 'rgba(255, 107, 95, 0.16)',
  // Garage hero — the elevated `card` surface like every other Garage card,
  // not the white CTA fill. Values reuse this theme's card / text /
  // textMuted / border / brandSoft.
  hero: '#111111',
  onHero: '#ffffff',
  heroMuted: '#8f8f8f',
  heroDivider: '#2a2a2a',
  heroWash: 'rgba(255, 255, 255, 0.12)',
  // Home's selected-vehicle banner keeps the hero treatment in dark mode.
  vehicleBanner: '#111111',
  vehicleBannerBorder: '#111111',
  onVehicleBanner: '#ffffff',
  vehicleBannerMuted: '#8f8f8f',
};

export function createNavigationTheme(scheme: 'light' | 'dark') {
  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const tokens = scheme === 'dark' ? darkTokens : lightTokens;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: tokens.brand,
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
