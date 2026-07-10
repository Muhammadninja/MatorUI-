import { memo } from 'react';

import { WheelMark } from '@/components/shared/app-logo';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type RatingProps = {
  value: number;
  size?: number;
};

/** Wheel-mark (the logo tire) + numeric rating — the brand's rating glyph
 *  in place of the generic ★. */
function Rating({ value, size = 12 }: RatingProps) {
  const { tokens } = useThemeContext();
  // Guard against NaN/undefined so the rating never renders "NaN".
  const safeValue = Number.isFinite(value) ? value : 0;
  return (
    <AppView row align="center" gap={4}>
      <WheelMark size={size + 1} color={tokens.rating} />
      <AppText family="accent" weight="semibold" style={{ fontSize: size, color: tokens.text }}>
        {safeValue.toFixed(1)}
      </AppText>
    </AppView>
  );
}

export default memo(Rating);
