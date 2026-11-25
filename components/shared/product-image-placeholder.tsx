import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, type DimensionValue } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { useThemeContext } from '@/contexts/theme.context';

// These are stable backend category ids/slugs. Never infer an illustration
// from translated names or fixture ordering.
const CATEGORY_SHAPE: Record<string, number> = {
  cat_oil_filters: 1,
  oil_filters: 1,
  'oil-filters': 1,
  cat_air_filters: 2,
  air_filters: 2,
  'air-filters': 2,
  cat_cabin_filters: 2,
  cabin_filters: 2,
  'cabin-filters': 2,
  cat_brake_pads: 3,
  brake_pads: 3,
  'brake-pads': 3,
  cat_brake_discs: 4,
  brake_discs: 4,
  'brake-discs': 4,
  cat_brakes: 4,
  cat_spark_plugs: 5,
  spark_plugs: 5,
  'spark-plugs': 5,
  cat_shock_absorbers: 6,
  shock_absorbers: 6,
  'shock-absorbers': 6,
  cat_suspension_arms: 7,
  suspension_arms: 7,
  'suspension-arms': 7,
  cat_belts_tensioners: 8,
  belts_tensioners: 8,
  'belts-tensioners': 8,
  cat_engine_belts: 8,
  cat_bearings_hubs: 9,
  bearings_hubs: 9,
  'bearings-hubs': 9,
  cat_oils_fluids: 10,
  oils_fluids: 10,
  'oils-and-fluids': 10,
  cat_batteries: 11,
  batteries: 11,
  cat_radiators_cooling: 12,
  radiators_cooling: 12,
  'radiators-cooling': 12,
  cat_sensors_electrical: 13,
  sensors_electrical: 13,
  'sensors-electrical': 13,
  cat_engine_components: 14,
  engine_components: 14,
  'engine-components': 14,
  cat_engine: 14,
  cat_windshield_wipers: 15,
  windshield_wipers: 15,
  'windshield-wipers': 15,
};

export function resolveProductImageShape(categoryId?: string): number {
  return categoryId ? (CATEGORY_SHAPE[categoryId.toLowerCase()] ?? 0) : 0;
}

export type ProductImagePlaceholderProps = {
  categoryId?: string;
  width?: DimensionValue;
  height?: DimensionValue;
  backgroundColor?: string;
  radius?: number;
  label?: string;
  manufacturer?: string;
  manufacturerMaxWidth?: DimensionValue;
  photoPlanned?: boolean;
  showPhotoCaption?: boolean;
  photoCaption?: string;
};

/** A consistent semi-isometric illustration family for catalog photography gaps. */
function ProductImagePlaceholder({
  categoryId,
  width = '100%',
  height = '100%',
  backgroundColor,
  radius = 0,
  label,
  manufacturer,
  manufacturerMaxWidth = '64%',
  photoPlanned = false,
  showPhotoCaption = true,
  photoCaption,
}: ProductImagePlaceholderProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const shape = resolveProductImageShape(categoryId);
  const fill = tokens.productPlaceholderFill;
  const fillSide = tokens.productPlaceholderSide;
  const highlight = tokens.productPlaceholderHighlight;
  const art = (path: number) => {
    switch (path) {
      case 1:
        return (
          <>
            <Path d="M27 13h14l5 7v25l-5 7H27l-5-7V20z" fill={fill} />
            <Path d="m41 13 7 5v27l-7 7" fill={fillSide} />
            <Ellipse cx="32" cy="20" rx="10" ry="4" fill={highlight} />
            <Path d="M23 28h18M23 34h18M23 40h18M27 13l-5 7v25l5 7m14-39 7 7v25l-7 7" />
          </>
        );
      case 2:
        return (
          <>
            {/* Panel air filter: pleated media inside a rigid rectangular frame. */}
            <Path d="m17 23 7-6h25l-7 6z" fill={fillSide} />
            <Path d="m42 23 7-6v25l-7 7z" fill={fillSide} />
            <Path d="M17 23h25v26H17z" fill={fill} />
            <Path d="M20 27h19v18H20z" fill={highlight} />
            <Path d="m20 28 2 16 2-16 2 16 2-16 2 16 2-16 2 16 2-16 2 16 2-16" />
            <Path d="m17 23 7-6h25v25l-7 7H17zM42 23v26M17 49l7-7h25" />
          </>
        );
      case 3:
        return (
          <>
            {/* Brake pad: friction lining inset on a curved backing plate. */}
            <Path d="m34 23 6-4 8 3 3 5v15l-4 5-11-3z" fill={fillSide} />
            <Path d="m18 25 4-5 12 1 4 5-2 17-5 7h-9l-4-5z" fill={fill} />
            <Path d="m21 26 3-3 8 1 3 3-2 14-4 5h-5l-3-4z" fill={highlight} />
            <Path d="m18 25 4-5 12 1 4 5-2 17-5 7h-9l-4-5zM34 23l6-4 8 3 3 5v15l-4 5-11-3" />
            <Path d="m21 26 3-3 8 1 3 3-2 14-4 5h-5l-3-4zM23 20l1-4 8 1 2 4m6-3 1-4 7 2 1 5" />
          </>
        );
      case 4:
        return (
          <>
            <Ellipse cx="31" cy="33" rx="14" ry="19" transform="rotate(-18 31 33)" fill={fill} />
            <Ellipse cx="37" cy="33" rx="5" ry="19" transform="rotate(-18 37 33)" fill={fillSide} />
            <Ellipse
              cx="31"
              cy="33"
              rx="14"
              ry="19"
              transform="rotate(-18 31 33)"
              fill={highlight}
              opacity={0.7}
            />
            <Ellipse cx="31" cy="33" rx="6" ry="9" transform="rotate(-18 31 33)" fill={fillSide} />
            <Ellipse cx="31" cy="33" rx="14" ry="19" transform="rotate(-18 31 33)" />
            <Ellipse cx="31" cy="33" rx="6" ry="9" transform="rotate(-18 31 33)" />
            <Circle cx="28" cy="17" r="1.2" />
            <Circle cx="41" cy="26" r="1.2" />
            <Circle cx="37" cy="44" r="1.2" />
            <Circle cx="21" cy="41" r="1.2" />
            <Circle cx="19" cy="25" r="1.2" />
          </>
        );
      case 5:
        return (
          <>
            <Path d="m28 13 12 4-3 11v13l-7 11-7-11V28z" fill={fill} />
            <Path d="m40 17 4 5-3 7v14l-11 9 7-11V28z" fill={fillSide} />
            <Path d="m28 13 12 4-3 11H25l-3-7z" fill={highlight} />
            <Path d="m28 13 12 4-3 11v13l-7 11-7-11V28zM25 28h12m-12 5h12m-12 5h12" />
          </>
        );
      case 6:
        return (
          <>
            <Path d="m27 12 10 0 2 9-4 4v20l-4 8-5-8V25l-4-4z" fill={fill} />
            <Path d="m37 12 5 4-2 9v20l-9 8 4-8V25l4-4z" fill={fillSide} />
            <Path d="M27 12h10l5 4-2 5H23l-1-5z" fill={highlight} />
            <Path d="m27 12 10 0 2 9-4 4v20l-4 8-5-8V25l-4-4zM24 25h13m-11 4h10m-8 16h8" />
            <Circle cx="32" cy="10" r="2" />
          </>
        );
      case 7:
        return (
          <>
            <Path d="m15 39 11-20 13 3 12 15-7 9-13-7-9 9z" fill={fill} />
            <Path d="m39 22 7 3 9 12-7 9-7-4 6-7z" fill={fillSide} />
            <Path d="m15 39 11-20 13 3-4 13-13 13z" fill={highlight} />
            <Path d="m15 39 11-20 13 3 12 15-7 9-13-7-9 9z" />
            <Circle cx="25" cy="20" r="4" fill={fillSide} />
            <Circle cx="45" cy="42" r="4" fill={fillSide} />
            <Circle cx="25" cy="20" r="1.5" />
            <Circle cx="45" cy="42" r="1.5" />
          </>
        );
      case 8:
        return (
          <>
            <Ellipse cx="32" cy="32" rx="18" ry="11" transform="rotate(-32 32 32)" fill={fill} />
            <Ellipse
              cx="32"
              cy="32"
              rx="10"
              ry="5"
              transform="rotate(-32 32 32)"
              fill={highlight}
            />
            <Circle cx="17" cy="44" r="6" fill={fillSide} />
            <Circle cx="44" cy="18" r="6" fill={fillSide} />
            <Ellipse cx="32" cy="32" rx="18" ry="11" transform="rotate(-32 32 32)" />
            <Ellipse cx="32" cy="32" rx="10" ry="5" transform="rotate(-32 32 32)" />
            <Circle cx="17" cy="44" r="6" />
            <Circle cx="44" cy="18" r="6" />
          </>
        );
      case 9:
        return (
          <>
            <Path d="m20 18 22 0 8 8v21H28l-8-8z" fill={fill} />
            <Path d="m42 18 8 8v21l-8-8z" fill={fillSide} />
            <Circle cx="31" cy="32" r="12" fill={highlight} />
            <Circle cx="31" cy="32" r="5" fill={fillSide} />
            <Path d="m20 18 22 0 8 8v21H28l-8-8z" />
            <Circle cx="31" cy="32" r="12" />
            <Circle cx="31" cy="32" r="5" />
            <Circle cx="31" cy="22" r="1.3" />
            <Circle cx="40" cy="29" r="1.3" />
            <Circle cx="37" cy="40" r="1.3" />
          </>
        );
      case 10:
        return (
          <>
            <Path d="M25 14h14v8l6 6v23H19V28l6-6z" fill={fill} />
            <Path d="m39 14 5 4v7l6 6v20l-5 4V28l-6-6z" fill={fillSide} />
            <Path d="M25 14h14l5 4v4H25z" fill={highlight} />
            <Path d="M25 14h14v8l6 6v23H19V28l6-6zM25 22h14m-14 19h14" />
            <Path d="M27 31h8" />
          </>
        );
      case 11:
        return (
          <>
            <Path d="m16 21 7-5h30v30l-7 5H16z" fill={fill} />
            <Path d="m16 21 7-5v29l-7 6z" fill={fillSide} />
            <Path d="m23 16 6 5h30v30H29l-6-6z" fill={highlight} />
            <Path d="M16 21h37v30H16zm8-5v5m18-5v5" />
            <Path d="M33 28v12m-6-6h12m8 0h-5" />
          </>
        );
      case 12:
        return (
          <>
            <Path d="m18 17 7-5h25v37H25l-7-5z" fill={fill} />
            <Path d="m18 17 7-5v37l-7-5z" fill={fillSide} />
            <Path d="m25 12 7 5h25v37H32l-7-5z" fill={highlight} />
            <Path d="M25 12h25v37H25zM31 18v25m6-25v25m6-25v25m6-25v25M18 24h7m25 18h7" />
          </>
        );
      case 13:
        return (
          <>
            <Path d="m22 23 10-8 10 8v18l-10 8-10-8z" fill={fill} />
            <Path d="m42 23 7 4v18l-17 4 10-8z" fill={fillSide} />
            <Path d="m22 23 10-8 10 8-10 8z" fill={highlight} />
            <Path d="m22 23 10-8 10 8v18l-10 8-10-8zM42 23l7 4v18l-17 4M32 15v8m0 18v8m-10-26-5-4m30 27 5 4" />
            <Circle cx="32" cy="32" r="5" />
            <Circle cx="32" cy="32" r="1.5" />
          </>
        );
      case 14:
        return (
          <>
            <Path d="m19 20 8-6h17l6 8v24l-8 5H24l-5-7z" fill={fill} />
            <Path d="m44 14 6 8v24l-8 5V22z" fill={fillSide} />
            <Path d="m19 20 8-6h17l6 8H26z" fill={highlight} />
            <Path d="m19 20 8-6h17l6 8v24l-8 5H24l-5-7zM26 22v22m9-22v22" />
            <Circle cx="37" cy="33" r="6" />
          </>
        );
      case 15:
        return (
          <>
            <Path d="m16 43 29-27 5 6-29 28z" fill={fill} />
            <Path d="m45 16 5 6-29 28-3-7z" fill={fillSide} />
            <Path d="m16 43 29-27 3 4-29 27z" fill={highlight} />
            <Path d="m16 43 29-27 5 6-29 28zM15 43l7 7m17-31 7 8m-23 11 4 5m4-11 4 5m4-11 4 5" />
          </>
        );
      default:
        return (
          <>
            <Path d="m20 23 12-8 12 8v18l-12 8-12-8z" fill={fill} />
            <Path d="m44 23 7 4v18l-19 4 12-8z" fill={fillSide} />
            <Path d="m20 23 12-8 12 8-12 8z" fill={highlight} />
            <Path d="m20 23 12-8 12 8v18l-12 8-12-8z" />
            <Circle cx="32" cy="32" r="6" />
          </>
        );
    }
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: backgroundColor ?? tokens.productPlaceholderBackground,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        paddingVertical: 5,
      }}
    >
      {manufacturer ? (
        <Text
          numberOfLines={1}
          style={{
            maxWidth: manufacturerMaxWidth,
            textAlign: 'center',
            color: tokens.productPlaceholderManufacturer,
            fontSize: 9,
            lineHeight: 12,
            fontWeight: '700',
            letterSpacing: 0,
            textTransform: 'uppercase',
            marginBottom: 1,
          }}
        >
          {manufacturer}
        </Text>
      ) : null}
      <Svg
        width="72%"
        height="72%"
        viewBox="0 0 64 64"
        fill="none"
        stroke={tokens.productPlaceholderOutline}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {art(shape)}
      </Svg>
      {showPhotoCaption ? (
        <Text
          numberOfLines={1}
          style={{
            color: tokens.textMuted,
            fontSize: 9,
            lineHeight: 12,
            fontWeight: '500',
            letterSpacing: 0,
            marginTop: 1,
          }}
        >
          {photoCaption ?? t(photoPlanned ? 'catalog.photoComingSoon' : 'catalog.photoOnRequest')}
        </Text>
      ) : null}
    </View>
  );
}

export default memo(ProductImagePlaceholder);
