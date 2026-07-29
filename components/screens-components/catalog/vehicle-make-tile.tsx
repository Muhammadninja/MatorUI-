import { memo } from 'react';

import BrandLogo, { hasBrandLogo } from '@/components/screens-components/catalog/brand-logo';
import { brandColor } from '@/components/screens-components/catalog/brand-meta';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type VehicleMakeTileProps = {
  /** Brand id used for navigation. */
  brandId: string;
  /** Brand display name (must match a `BrandLogo` key). */
  label: string;
  onPress: (brandId: string) => void;
};

/**
 * `VehicleMakeTile` — a single "Shop by vehicle" tile: the brand logo on a
 * white rounded chip. Presentational; the parent supplies the brand + tap
 * handler.
 */
function VehicleMakeTile({ brandId, label, onPress }: VehicleMakeTileProps) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={() => onPress(brandId)}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityLabel={`Shop ${label} vehicles`}
      align="center"
      gap={8}
      style={{ width: 84 }}
    >
      <AppView center rounded={20} style={{ width: 65, height: 65, backgroundColor: tokens.white }}>
        {hasBrandLogo(label) ? (
          <BrandLogo name={label} size={50} />
        ) : (
          // Admin-added brands may have no bundled SVG logo yet — show the
          // brand initial so the tile is never a blank white chip.
          <AppText
            family="heading"
            weight="bold"
            style={{ fontSize: 26, color: brandColor(brandId) }}
          >
            {label.charAt(0).toUpperCase()}
          </AppText>
        )}
      </AppView>
    </AppPressableView>
  );
}

export default memo(VehicleMakeTile);
