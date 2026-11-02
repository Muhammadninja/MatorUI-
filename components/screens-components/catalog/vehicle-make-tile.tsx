import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import BrandLogo from '@/components/screens-components/catalog/brand-logo';
import { brandColor } from '@/components/screens-components/catalog/brand-meta';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type VehicleMakeTileProps = {
  /** Brand id used for navigation. */
  brandId: string;
  /** Brand display name. */
  label: string;
  /** Backend logo URL; null → initial fallback (handled by BrandLogo). */
  logoUrl?: string | null;
  /** Teaser brand — rendered dimmed/disabled; tapping opens a "coming soon" modal. */
  comingSoon?: boolean;
  onPress: (brandId: string) => void;
};

/**
 * `VehicleMakeTile` — a single "Shop by vehicle" tile: the brand logo on a
 * white rounded chip. A `comingSoon` brand renders with a faded MARK on the
 * same chip (see below); the parent decides tap behavior (it opens a "coming
 * soon" modal instead of navigating).
 */
const VehicleMakeTile = ({
  brandId,
  label,
  logoUrl,
  comingSoon,
  onPress,
}: VehicleMakeTileProps) => {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={() => onPress(brandId)}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityLabel={
        comingSoon ? t('make.tileComingSoon', { label }) : t('make.tileShop', { label })
      }
      accessibilityState={{ disabled: !!comingSoon }}
      align="center"
      gap={8}
      style={{ width: 84 }}
    >
      {/* The chip stays the same white in every state. Dimming the CHIP for
       *  a coming-soon brand was invisible in light mode (45% white on white)
       *  and turned it into a muddy grey square in dark, so the row read as
       *  mismatched tiles rather than as two brands not being live yet. The
       *  MARK is what fades now — same treatment in both themes. */}
      <AppView center rounded={20} style={{ width: 65, height: 65, backgroundColor: tokens.white }}>
        <AppView style={{ opacity: comingSoon ? 0.55 : 1 }}>
          <BrandLogo logoUrl={logoUrl} name={label} size={50} color={brandColor(brandId)} />
        </AppView>
      </AppView>
      <AppView align="center" gap={2} style={{ alignSelf: 'stretch' }}>
        <AppText textVariant="bodyXs" weight="medium" align="center" style={{ lineHeight: 16 }}>
          {label}
        </AppText>
        {comingSoon ? (
          <AppText textVariant="caption" colorName="textMuted" align="center">
            {t('modalHost.comingSoonTitle')}
          </AppText>
        ) : null}
      </AppView>
    </AppPressableView>
  );
};

export default memo(VehicleMakeTile);
