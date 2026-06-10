import { useWindowDimensions } from 'react-native';

/**
 * Returns a min-height value scaled by the user's font-scale preference.
 *
 * Usage:
 *   const minH = useScaledMinHeight(56);  // base = 56dp at fontScale=1
 *   <AppView style={{ minHeight: minH }}> ... </AppView>
 *
 * When fontScale=1 returns the base. When the user enables Larger Text,
 * the returned value grows proportionally so two-line content doesn't
 * overflow / clip. Use on text-bearing rows ONLY — decorative icon
 * boxes should stay fixed so the icon-to-text ratio doesn't drift.
 *
 * Cap fontScale at 2 by default — beyond that, layouts read as broken
 * even with the scale, and we prefer to enforce wrap-to-next-line over
 * unbounded tap targets.
 */
export function useScaledMinHeight(base: number, maxScale = 2): number {
  const { fontScale } = useWindowDimensions();
  return Math.round(base * Math.min(fontScale, maxScale));
}
