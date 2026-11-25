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
  productPlaceholderBackground: '#F7FAF9',
  productPlaceholderFill: '#D5E9E4',
  productPlaceholderSide: '#D5E9E4',
  productPlaceholderHighlight: '#E8F3EF',
  productPlaceholderOutline: '#377D78',
  productPlaceholderManufacturer: '#245F5B',
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
  // Explore's add-a-car hero: a mint wash with soft teal curves behind the car.
  garageHeroFrom: '#EEF9F7',
  garageHeroTo: '#D5EFEB',
  garageHeroShape: 'rgba(0, 166, 160, 0.10)',
  garageHeroShapeStrong: 'rgba(0, 166, 160, 0.18)',
  garageHeroBorder: '#C5E3E1',
  garageHeroShadow: 'rgba(11, 16, 20, 0.16)',
  onPhotoAccent: '#007F86',
  onPhotoMuted: '#61616B',
  photoShimmer: '#f1f1f1',
  assistantFab: '#007F86',
  onAssistantFab: '#FFFFFF',
  assistantFabShadow: '#9a9a9a',
};

// "Midnight Teal": blue-black surfaces stepped by lightness, separated by
// borders rather than shadows, with the teal brand as the interaction colour.
// White on #00A6A0 is 3.0:1, so everything set ON teal is the page ink instead.
export const darkTokens: ThemeTokens = {
  background: '#0B1014',
  // Elevated surfaces and inputs (search field, sheet rows).
  backgroundSecondary: '#222B31',
  productPlaceholderBackground: '#202E2B',
  productPlaceholderFill: '#344744',
  productPlaceholderSide: '#344744',
  productPlaceholderHighlight: '#405853',
  productPlaceholderOutline: '#76B7AF',
  productPlaceholderManufacturer: '#8FCBC3',
  surface: '#171E23',
  card: '#171E23',
  onCard: '#F5F7F8',
  text: '#F5F7F8',
  onBackground: '#F5F7F8',
  // Secondary text. The handoff's #6E7A80 muted grey is 3.3:1 on an input, too
  // faint for words, so it is kept for disabled labels only (`disabledFg`).
  textMuted: '#9BA8AF',
  border: '#2C373F',
  // 3.1:1 on an input, 3.7:1 on a card — enough to be a control's only edge.
  controlBorder: '#6B7780',
  divider: '#232C33',
  overlay: 'rgba(255, 255, 255, 0.10)',
  primary: '#F5F7F8',
  primaryBg: '#F5F7F8',
  primaryPressed: '#DCE2E5',
  onPrimary: '#0B1014',
  secondary: '#F5F7F8',
  // The `secondary` button mirrors light: a raised surface, a light label and
  // an outline, rather than a white slab.
  secondaryBg: '#222B31',
  secondaryPressed: '#2B333C',
  onSecondary: '#0B1014',
  onSecondaryBg: '#F5F7F8',
  secondaryBorder: '#6B7780',
  brand: '#00A6A0',
  // A brighter teal for words: 8:1 on a card where `brand` is 5.6:1.
  brandText: '#34C6BE',
  brandBg: '#00A6A0',
  brandPressed: '#008C87',
  onBrand: '#0B1014',
  success: '#4ADE80',
  successPressed: '#22C55E',
  warning: '#FBBF24',
  warningPressed: '#F59E0B',
  error: '#F87171',
  errorPressed: '#EF4444',
  // Teal carries information in light mode too; there is no blue.
  info: '#34C6BE',
  infoPressed: '#00A6A0',
  disabledBg: '#222B31',
  disabledFg: '#6E7A80',
  outlinePressedOverlay: 'rgba(255, 255, 255, 0.08)',
  ghostPressedOverlay: 'rgba(255, 255, 255, 0.06)',
  linkPressedOverlay: 'rgba(255, 255, 255, 0.10)',
  switchTrackOff: '#3A4550',
  switchTrackOn: '#00A6A0',
  switchThumbOn: '#F5F7F8',
  listPressedOverlay: 'rgba(255, 255, 255, 0.05)',
  textPressed: '#DCE2E5',
  icon: '#F5F7F8',
  gray50: '#11171B',
  gray100: '#171E23',
  gray200: '#222B31',
  gray300: '#34404A',
  gray400: '#6E7A80',
  white: '#ffffff',
  black: '#000000',
  rating: '#F59E0B',
  accolade: '#b8860b',
  value: '#15803d',
  onValue: '#05310f',
  scrim: 'rgba(0, 0, 0, 0.55)',
  scannerAccent: '#00e676',
  brandSoft: 'rgba(0, 166, 160, 0.16)',
  successSoft: 'rgba(74, 222, 128, 0.14)',
  infoSoft: 'rgba(52, 198, 190, 0.14)',
  warningSoft: 'rgba(251, 191, 36, 0.14)',
  errorSoft: 'rgba(248, 113, 113, 0.14)',
  // Garage hero — the card surface like every other Garage card.
  hero: '#171E23',
  onHero: '#F5F7F8',
  heroMuted: '#9BA8AF',
  heroDivider: '#2C373F',
  heroWash: 'rgba(255, 255, 255, 0.08)',
  // Home's selected-vehicle banner keeps the hero treatment, now with an
  // edge so it separates from the page without a shadow.
  vehicleBanner: '#171E23',
  vehicleBannerBorder: '#2C373F',
  onVehicleBanner: '#F5F7F8',
  vehicleBannerMuted: '#9BA8AF',
  // Explore's add-a-car hero: charcoal easing into deep teal, curves kept
  // faint so the white car and the copy carry the contrast.
  garageHeroFrom: '#171E23',
  garageHeroTo: '#113130',
  garageHeroShape: 'rgba(0, 166, 160, 0.10)',
  garageHeroShapeStrong: 'rgba(52, 198, 190, 0.16)',
  garageHeroBorder: '#24403F',
  garageHeroShadow: 'rgba(0, 0, 0, 0.42)',
  onPhotoAccent: '#007F86',
  onPhotoMuted: '#61616B',
  photoShimmer: '#E6EAEC',
  assistantFab: '#00A6A0',
  onAssistantFab: '#0B1014',
  assistantFabShadow: '#000000',
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
