import { Image } from 'expo-image';
import { memo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { CarIcon, type CarBody } from '@/components/shared/mator-icons';
import { useThemeContext } from '@/contexts/theme.context';
import type { VehicleImageSource } from '@/services/vehicle-images/manifest';

const COBALT = require('@/assets/cars-2d/chevrolet-cobalt-white.png');
/** Vehicle images are 2:1: the car spans ~82% of the width, tyres on the
 *  bottom edge (docs/vehicle-images/chevrolet-asset-matrix.md §10). */
const CAR_ASPECT = 2;
const PADDING = 16;
const RADIUS = 16;
/** Explore's horizontal gutter, used until the card reports its own width. */
const PAGE_GUTTER = 16;

/** What the hero's 2:1 car slot shows. */
export type GarageHeroVisual =
  /** An approved image of this exact vehicle (from the vehicle image resolver). */
  | { kind: 'image'; source: VehicleImageSource }
  /** A neutral body silhouette: no approved image for this vehicle. */
  | { kind: 'placeholder'; body: CarBody };

type GarageHeroCardProps = {
  testID: string;
  /** Omitted only by the empty state, which shows the decorative Cobalt. */
  visual?: GarageHeroVisual;
  /** Copy column: title, supporting text, and any inline action. */
  children: ReactNode;
  action: { testID: string; title: string; onPress: () => void };
};

/**
 * Explore's garage hero: copy and the teal action on the left, a car over a
 * mint (light) or charcoal-teal (dark) wash on the right.
 *
 * The car sits in the top-right beside the copy, and the button runs below
 * both, so the button keeps its full label and touch size on the narrowest
 * iPhone instead of squeezing into the copy's column.
 */
export function GarageHeroCard({ testID, visual, children, action }: GarageHeroCardProps) {
  const { tokens } = useThemeContext();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  const width = measured?.width ?? windowWidth - PAGE_GUTTER * 2;
  const height = measured?.height ?? 0;
  // At large text the copy needs the full width; the car moves above it.
  const stacked = fontScale >= 1.3;

  const carWidth = Math.round(width * (stacked ? 0.66 : 0.54));
  const carHeight = Math.round(carWidth / CAR_ASPECT);
  // Bleed slightly past the right edge so the car reads as parked in the card.
  const carRight = -Math.round(width * 0.05);
  const carTop = stacked ? PADDING / 2 : PADDING + 4;
  const copyWidth = stacked ? width - PADDING * 2 : Math.round(width * 0.5) - PADDING;
  const isPlaceholder = visual?.kind === 'placeholder';

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    if (!measured || measured.width !== w || measured.height !== h) setMeasured({ width: w, height: h });
  };

  // Where the car's tyres meet the ground, for the soft shadow.
  const groundX = width + carRight - carWidth / 2;
  const groundY = carTop + carHeight * 0.92;

  return (
    <AppView
      testID={testID}
      rounded={RADIUS}
      borderWidth={1}
      style={{ borderColor: tokens.garageHeroBorder, overflow: 'hidden' }}
      onLayout={onLayout}
    >
      {height > 0 ? (
        <Svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Defs>
            <LinearGradient id="garage-hero-wash" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={tokens.garageHeroFrom} />
              <Stop offset="1" stopColor={tokens.garageHeroTo} />
            </LinearGradient>
            <RadialGradient id="garage-hero-ground" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={tokens.garageHeroShadow} />
              <Stop offset="1" stopColor={tokens.garageHeroShadow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#garage-hero-wash)" />
          {/* Soft curves behind the car: one broad arc, one sweep rising from the bottom. */}
          <Circle cx={width * 0.8} cy={carTop + carHeight * 0.55} r={carHeight * 0.95} fill={tokens.garageHeroShape} />
          <Path
            d={`M ${width * 0.3} ${height} C ${width * 0.52} ${height * 0.62}, ${width * 0.78} ${height * 0.5}, ${width} ${height * 0.42} L ${width} ${height} Z`}
            fill={tokens.garageHeroShapeStrong}
          />
          {/* A silhouette casts no shadow: it isn't a car standing in the scene. */}
          {isPlaceholder ? null : (
            <Ellipse cx={groundX} cy={groundY} rx={carWidth * 0.46} ry={carHeight * 0.1} fill="url(#garage-hero-ground)" />
          )}
        </Svg>
      ) : null}

      {isPlaceholder ? (
        <AppView
          testID={`${testID}-vehicle-placeholder`}
          center
          style={{ position: 'absolute', top: carTop, right: carRight + width * 0.05, width: carWidth, height: carHeight, opacity: 0.55 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <CarIcon body={visual.body} size={Math.round(carHeight * 1.5)} color={tokens.vehicleBannerMuted} />
        </AppView>
      ) : (
        <Image
          testID={visual ? `${testID}-vehicle-image` : undefined}
          source={visual?.kind === 'image' ? visual.source : COBALT}
          contentFit="contain"
          style={{ position: 'absolute', top: carTop, right: carRight, width: carWidth, height: carHeight }}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      )}

      <AppView p="lg" gap="lg" style={stacked ? { paddingTop: carTop + carHeight + 8 } : undefined}>
        <AppView gap="xs" style={{ width: copyWidth, minHeight: stacked ? undefined : carTop + carHeight - PADDING }}>
          {children}
        </AppView>

        <AppButton
          testID={action.testID}
          title={action.title}
          kind="brand"
          size="lg"
          fullWidth={stacked}
          style={stacked ? undefined : { alignSelf: 'flex-start' }}
          onPress={action.onPress}
        />
      </AppView>
    </AppView>
  );
}

/**
 * Explore's empty garage state. The Cobalt here is decorative artwork for
 * "add your car", not a picture of anyone's vehicle, so it is never passed
 * through the vehicle image resolver.
 */
function GarageAddHero({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <GarageHeroCard
      testID="home-garage-card"
      action={{ testID: 'home-garage-add-vehicle', title: t('explore.addVehicleAction'), onPress }}
    >
      <AppText textVariant="h4" weight="bold" style={{ color: tokens.onVehicleBanner }}>
        {t('explore.addVehicleTitle')}
      </AppText>
      <AppText textVariant="bodySm" style={{ color: tokens.vehicleBannerMuted }}>
        {t('explore.addVehicleBody')}
      </AppText>
    </GarageHeroCard>
  );
}

export default memo(GarageAddHero);
