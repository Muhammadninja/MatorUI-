import { Image } from 'expo-image';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import BrandLogo from '@/components/screens-components/catalog/brand-logo';
import { brandColor } from '@/components/screens-components/catalog/brand-meta';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const BUNDLED_BRAND_LOGOS = {
  chevrolet: {
    light: require('../../../assets/brands/optimized/chevrolet.webp'),
    dark: require('../../../assets/brands/optimized/chevrolet.webp'),
  },
  byd: {
    light: require('../../../assets/brands/optimized/byd.webp'),
    dark: require('../../../assets/brands/optimized/byd.webp'),
  },
  leapmotor: {
    light: require('../../../assets/brands/optimized/leapmotor.webp'),
    dark: require('../../../assets/brands/optimized/leapmotor-light.webp'),
  },
  volkswagen: {
    light: require('../../../assets/brands/optimized/volkswagen.webp'),
    dark: require('../../../assets/brands/optimized/volkswagen-light.webp'),
  },
  vw: {
    light: require('../../../assets/brands/optimized/volkswagen.webp'),
    dark: require('../../../assets/brands/optimized/volkswagen-light.webp'),
  },
} as const;

const BRAND_LOGO_FRAMES: Record<string, { width: number; height: number }> = {
  chevrolet: { width: 58, height: 30 },
  byd: { width: 58, height: 26 },
  leapmotor: { width: 55, height: 34 },
  volkswagen: { width: 44, height: 44 },
  vw: { width: 44, height: 44 },
};

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
  const { tokens, scheme } = useThemeContext();
  const brandKey = brandId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const bundledLogo = BUNDLED_BRAND_LOGOS[brandKey as keyof typeof BUNDLED_BRAND_LOGOS];
  const logoSource = bundledLogo?.[scheme === 'dark' ? 'dark' : 'light'];
  const logoFrame = BRAND_LOGO_FRAMES[brandKey] ?? { width: 50, height: 50 };
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
      {/* Preserve the white chips in light mode; dark mode uses a raised card
       *  surface with a quiet outline. Availability dims the mark only. */}
      <AppView
        center
        rounded={20}
        style={{
          width: 65,
          height: 65,
          backgroundColor: scheme === 'dark' ? '#E8ECEF' : tokens.white,
          borderWidth: scheme === 'dark' ? 1 : 0,
          borderColor: tokens.divider,
        }}
      >
        <AppView style={{ opacity: comingSoon ? 0.55 : 1 }}>
          {logoSource ? (
            <Image
              source={logoSource}
              style={logoFrame}
              contentFit="contain"
              accessibilityLabel={t('make.brandLogo', { name: label })}
            />
          ) : (
            <BrandLogo logoUrl={logoUrl} name={label} size={50} color={brandColor(brandId)} />
          )}
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
