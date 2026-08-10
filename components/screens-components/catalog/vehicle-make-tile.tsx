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
  /** Teaser brand — rendered dimmed with a "Soon" badge. */
  comingSoon?: boolean;
  onPress: (brandId: string) => void;
};

/**
 * `VehicleMakeTile` — a single "Shop by vehicle" tile: the brand logo on a
 * white rounded chip. A `comingSoon` brand renders dimmed with a "Soon" badge;
 * the parent decides tap behavior (it does not navigate for coming-soon brands).
 */
const VehicleMakeTile = ({ brandId, label, logoUrl, comingSoon, onPress }: VehicleMakeTileProps) => {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={() => onPress(brandId)}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityLabel={comingSoon ? t('make.tileComingSoon', { label }) : t('make.tileShop', { label })}
      accessibilityState={{ disabled: !!comingSoon }}
      align="center"
      gap={8}
      style={{ width: 84 }}
    >
      <AppView style={{ width: 65, height: 65 }}>
        <AppView
          center
          rounded={20}
          style={{
            width: 65,
            height: 65,
            backgroundColor: tokens.white,
            opacity: comingSoon ? 0.45 : 1,
          }}
        >
          <BrandLogo logoUrl={logoUrl} name={label} size={50} color={brandColor(brandId)} />
        </AppView>
        {comingSoon ? (
          <AppView
            center
            rounded={999}
            style={{
              position: 'absolute',
              top: -6,
              right: -4,
              paddingHorizontal: 7,
              paddingVertical: 2,
              backgroundColor: tokens.text,
              borderWidth: 1.5,
              borderColor: tokens.background,
            }}
          >
            <AppText
              family="accent"
              weight="bold"
              style={{ fontSize: 9, color: tokens.background, letterSpacing: 0.3 }}
            >
              {t('make.soon')}
            </AppText>
          </AppView>
        ) : null}
      </AppView>
    </AppPressableView>
  );
}

export default memo(VehicleMakeTile);
