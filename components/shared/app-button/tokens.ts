import type { TextVariant } from '@/themes';
import type { ButtonSize } from './app-button';

export const DEFAULT_RADIUS = 12;

export const SIZE_MAP: Record<
  ButtonSize,
  { pv: number; ph: number; gap: number; font: number; icon: number; textVariant: TextVariant }
> = {
  xs: { pv: 6, ph: 10, gap: 4, font: 12, icon: 14, textVariant: 'buttonSm' },
  sm: { pv: 8, ph: 12, gap: 6, font: 14, icon: 16, textVariant: 'buttonSm' },
  md: { pv: 10, ph: 16, gap: 8, font: 16, icon: 18, textVariant: 'button' },
  lg: { pv: 14, ph: 18, gap: 10, font: 18, icon: 20, textVariant: 'button' },
  xl: { pv: 18, ph: 24, gap: 12, font: 20, icon: 24, textVariant: 'button' },
};
