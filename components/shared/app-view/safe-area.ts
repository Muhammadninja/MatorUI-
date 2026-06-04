import { Platform, type ViewStyle } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { SAFE_AREA_TOP_FALLBACK } from './tokens';

export type SafeAreaMode = boolean | 'top' | 'bottom' | 'vertical' | 'horizontal' | 'all';

/**
 * Compose safe area padding without clobbering explicit padding from spacing.
 * Accepts current computed spacing style and insets; returns additional padding style.
 */
export function composeSafeAreaPadding(options: {
  mode: SafeAreaMode;
  safeTop?: boolean;
  insets: EdgeInsets;
  spacing: ViewStyle;
}): ViewStyle {
  const { mode, safeTop, insets, spacing } = options;
  const s: ViewStyle = {};

  if (safeTop && Platform.OS === 'ios') {
    s.paddingTop = Math.max((spacing.paddingTop as number) ?? 0, SAFE_AREA_TOP_FALLBACK);
  }

  const resolvedMode = mode === true ? 'all' : mode;
  if (!resolvedMode) return s;

  const applyTop = resolvedMode === 'top' || resolvedMode === 'vertical' || resolvedMode === 'all';
  const applyBottom =
    resolvedMode === 'bottom' || resolvedMode === 'vertical' || resolvedMode === 'all';
  const applyLeft = resolvedMode === 'horizontal' || resolvedMode === 'all';
  const applyRight = resolvedMode === 'horizontal' || resolvedMode === 'all';

  // Resolve base explicit paddings, considering shorthand props from spacing
  const baseTop =
    (spacing.paddingTop as number) ??
    (spacing.paddingVertical as number) ??
    (spacing.padding as number) ??
    0;
  const baseBottom =
    (spacing.paddingBottom as number) ??
    (spacing.paddingVertical as number) ??
    (spacing.padding as number) ??
    0;
  const baseLeft =
    (spacing.paddingLeft as number) ??
    (spacing.paddingHorizontal as number) ??
    (spacing.padding as number) ??
    0;
  const baseRight =
    (spacing.paddingRight as number) ??
    (spacing.paddingHorizontal as number) ??
    (spacing.padding as number) ??
    0;
  if (applyTop) {
    s.paddingTop = Math.max(
      (s.paddingTop as number) ?? (spacing.paddingTop as number) ?? 0,
      insets.top,
    );
  }
  if (applyBottom) {
    s.paddingBottom = Math.max((spacing.paddingBottom as number) ?? 0, insets.bottom);
  }
  if (applyLeft) {
    s.paddingLeft = Math.max((spacing.paddingLeft as number) ?? 0, insets.left);
  }
  if (applyRight) {
    s.paddingRight = Math.max((spacing.paddingRight as number) ?? 0, insets.right);
  }

  return s;
}
