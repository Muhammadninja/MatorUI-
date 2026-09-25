import type { TextVariant, WeightName } from '@/themes';
import type { ButtonSize } from './app-button';

export const DEFAULT_RADIUS = 12;

/** Label weight when the caller passes none — the SemiBold of the `button` /
 *  `buttonSm` variants. It has to be explicit: AppText lays its default
 *  (Regular) family over any variant's own face, so a variant alone would
 *  still render Regular. */
export const DEFAULT_LABEL_WEIGHT: WeightName = 'semibold';

/**
 * Per-size geometry. `textVariant` is the label's design-system typography
 * (line height; its SemiBold comes via `DEFAULT_LABEL_WEIGHT`); `font` sets
 * the size and is applied on top unless the caller picks its own
 * `textVariant`. `lg` shares the `button` variant's 16px — the 18px it had
 * only ever rendered in the fallback Regular face, and it wrapped longer
 * labels into a two-line block.
 */
export const SIZE_MAP: Record<
  ButtonSize,
  { pv: number; ph: number; gap: number; font: number; icon: number; textVariant: TextVariant }
> = {
  xs: { pv: 6, ph: 10, gap: 4, font: 12, icon: 14, textVariant: 'buttonSm' },
  sm: { pv: 8, ph: 12, gap: 6, font: 14, icon: 16, textVariant: 'buttonSm' },
  md: { pv: 10, ph: 16, gap: 8, font: 16, icon: 18, textVariant: 'button' },
  lg: { pv: 14, ph: 18, gap: 10, font: 16, icon: 20, textVariant: 'button' },
  xl: { pv: 18, ph: 24, gap: 12, font: 20, icon: 24, textVariant: 'button' },
};
