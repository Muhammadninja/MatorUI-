import { Image } from 'expo-image';
import { memo } from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
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

const DARK_MONOCHROME_BRANDS = new Set([
  'byd',
  'chery',
  'daewoo',
  'genesis',
  'haval',
  'hyundai',
  'kia',
  'lada',
  'nissan',
  'skoda',
  'ssangyong',
  'toyota',
]);

const DARK_LOGO_SIZES: Record<string, number> = {
  daewoo: 59,
  haval: 58,
  hyundai: 56,
  ssangyong: 59,
};

const DARK_TILE_TOP = '#17383B';
const DARK_TILE_BOTTOM = '#09191D';
const DARK_TILE_GLOW = '#7D9698';

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
  const brandNameKey = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  const tintDarkLogo =
    scheme === 'dark' &&
    (DARK_MONOCHROME_BRANDS.has(brandNameKey) ||
      DARK_MONOCHROME_BRANDS.has(brandKey.replace(/^make/, '')));
  const logoSize = scheme === 'dark' ? (DARK_LOGO_SIZES[brandNameKey] ?? 50) : 50;
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
      {/* Keep the approved white chips in light mode. Dark tiles use a quiet
       *  teal gradient and outline; availability dims the mark only. */}
      <AppView
        center
        rounded={20}
        style={{
          width: 65,
          height: 65,
          backgroundColor: scheme === 'dark' ? DARK_TILE_BOTTOM : tokens.white,
          borderWidth: scheme === 'dark' ? 1 : 0,
          borderColor: scheme === 'dark' ? 'rgba(39, 102, 106, 0.38)' : tokens.divider,
          overflow: 'hidden',
        }}
      >
        {scheme === 'dark' ? (
          <Svg
            width={65}
            height={65}
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0 }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Defs>
              <LinearGradient id={`brand-tile-gradient-${brandKey}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={DARK_TILE_TOP} />
                <Stop offset="1" stopColor={DARK_TILE_BOTTOM} />
              </LinearGradient>
              <RadialGradient
                id={`brand-tile-glow-${brandKey}`}
                cx="50%"
                cy="46%"
                rx="58%"
                ry="54%"
              >
                <Stop offset="0" stopColor={DARK_TILE_GLOW} stopOpacity={0.16} />
                <Stop offset="1" stopColor={DARK_TILE_GLOW} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={65} height={65} rx={20} fill={`url(#brand-tile-gradient-${brandKey})`} />
            <Rect width={65} height={65} rx={20} fill={`url(#brand-tile-glow-${brandKey})`} />
          </Svg>
        ) : null}
        <AppView style={{ opacity: scheme === 'dark' ? 1 : comingSoon ? 0.55 : 1 }}>
          {logoSource ? (
            <Image
              source={logoSource}
              style={[
                {
                  width: brandNameKey === 'haval' ? 58 : logoFrame.width,
                  height: brandNameKey === 'haval' ? 58 : logoFrame.height,
                },
                tintDarkLogo ? { tintColor: '#E5EFF0' } : undefined,
              ]}
              contentFit="contain"
              accessibilityLabel={t('make.brandLogo', { name: label })}
            />
          ) : (
            <BrandLogo
              logoUrl={logoUrl}
              name={label}
              size={logoSize}
              color={brandColor(brandId)}
              tintColor={tintDarkLogo ? '#E5EFF0' : undefined}
            />
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
