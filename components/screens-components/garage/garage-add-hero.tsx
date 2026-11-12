import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { CarIcon, type CarBody } from '@/components/shared/mator-icons';
import { useThemeContext } from '@/contexts/theme.context';
import type { VehicleImageSource } from '@/services/vehicle-images/manifest';
import { triggerHaptic } from '@/utils/haptics';

import emptyGarageArt from '@/assets/hero/corvette-c8-red.webp';

/** Vehicle images are 2:1: the car spans ~82% of the width, tyres on the
 *  bottom edge (docs/vehicle-images/chevrolet-asset-matrix.md §10). */
const CAR_ASPECT = 2;
const PADDING = 16;
const RADIUS = 16;
/** Explore's horizontal gutter, used until the card reports its own width. */
const PAGE_GUTTER = 16;
/** Visible Corvette artwork bounds in its transparent 1200×600 source image. */
const ART_BOUNDS = { left: 117 / 1200, top: 220 / 600, right: 1084 / 1200, bottom: 596 / 600 };

/** What the hero's 2:1 car slot shows. */
export type GarageHeroVisual =
  /** An approved image of this exact vehicle (from the vehicle image resolver). */
  | { kind: 'image'; source: VehicleImageSource }
  /** A neutral body silhouette: no approved image for this vehicle. */
  | { kind: 'placeholder'; body: CarBody };

type GarageHeroCardProps = {
  testID: string;
  visual: GarageHeroVisual;
  /** Empty-state-only artwork/layout refinements; selected-vehicle cards keep their geometry. */
  emptyGarage?: boolean;
  /** Draw the card's soft ground shadow under the car. Off for artwork that
   *  brings its own contact shadow. */
  groundShadow?: boolean;
  /** Optional image action; used only by the decorative empty-state Corvette. */
  onImagePress?: () => void;
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
export function GarageHeroCard({
  testID,
  visual,
  groundShadow = true,
  emptyGarage = false,
  onImagePress,
  children,
  action,
}: GarageHeroCardProps) {
  const { tokens } = useThemeContext();
  const { t } = useTranslation();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  const width = measured?.width ?? windowWidth - PAGE_GUTTER * 2;
  const height = measured?.height ?? 0;
  // At large text the copy needs the full width; the car moves above it.
  const stacked = fontScale >= 1.3;

  const carWidth = Math.round(width * (stacked ? 0.66 : emptyGarage ? 0.66 : 0.54));
  const carHeight = Math.round(carWidth / CAR_ASPECT);
  // Nudge the empty-state Corvette right and up without scaling the artwork.
  const carRight = -Math.round(width * (emptyGarage && !stacked ? 0.077 : 0.05));
  const carTop = stacked ? PADDING / 2 : PADDING + (emptyGarage ? 3 : 4);
  const copyWidth = stacked
    ? width - PADDING * 2
    : Math.round(width * (emptyGarage ? 0.55 : 0.5)) - PADDING;
  const isPlaceholder = visual.kind === 'placeholder';
  // Preserve the approved empty-card height as the car artwork grows.
  const copyMinHeight = emptyGarage && !stacked
    ? Math.round(width * 0.54 / CAR_ASPECT) + 4
    : carTop + carHeight - PADDING;

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
          <Circle cx={width * (emptyGarage ? 0.84 : 0.8)} cy={carTop + carHeight * 0.55} r={carHeight * 0.95} fill={tokens.garageHeroShape} />
          <Path
            d={`M ${width * 0.3} ${height} C ${width * 0.52} ${height * 0.62}, ${width * 0.78} ${height * 0.5}, ${width} ${height * 0.42} L ${width} ${height} Z`}
            fill={tokens.garageHeroShapeStrong}
          />
          {/* A silhouette casts no shadow: it isn't a car standing in the scene. */}
          {isPlaceholder || !groundShadow ? null : (
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
      ) : emptyGarage && onImagePress ? (
        <Pressable
          testID={`${testID}-vehicle-image-pressable`}
          accessibilityRole="button"
          accessibilityLabel={t('nav.garage')}
          onPress={onImagePress}
          style={({ pressed }) => ({
            position: 'absolute',
            top: carTop + carHeight * ART_BOUNDS.top,
            right: carRight + carWidth * (1 - ART_BOUNDS.right),
            width: carWidth * (ART_BOUNDS.right - ART_BOUNDS.left),
            height: carHeight * (ART_BOUNDS.bottom - ART_BOUNDS.top),
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Image
            testID={`${testID}-vehicle-image`}
            source={visual.source}
            contentFit="contain"
            style={{
              position: 'absolute',
              left: -carWidth * ART_BOUNDS.left,
              top: -carHeight * ART_BOUNDS.top,
              width: carWidth,
              height: carHeight,
              opacity: 0.96,
            }}
            accessibilityIgnoresInvertColors
            accessible={false}
            pointerEvents="none"
          />
        </Pressable>
      ) : (
        <Image
          testID={`${testID}-vehicle-image`}
          source={visual.source}
          contentFit="contain"
          style={{ position: 'absolute', top: carTop, right: carRight, width: carWidth, height: carHeight, opacity: emptyGarage ? 0.96 : 1 }}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      )}

      <AppView p="lg" gap={emptyGarage ? 'md' : 'lg'} style={stacked ? { paddingTop: carTop + carHeight + 8 } : undefined}>
        <AppView gap="xs" style={{ width: copyWidth, minHeight: stacked ? undefined : copyMinHeight }}>
          {children}
        </AppView>

        <AppButton
          testID={action.testID}
          title={action.title}
          kind="brand"
          // The empty-state action is secondary to the artwork: one size down.
          size={emptyGarage ? 'md' : 'lg'}
          fullWidth={stacked}
          style={stacked ? undefined : { alignSelf: 'flex-start' }}
          onPress={action.onPress}
        />
      </AppView>
    </AppView>
  );
}

/**
 * Explore's empty garage state. The red Corvette C8 is decorative artwork for
 * "start your garage", never a picture of anyone's vehicle: it is not passed
 * through the vehicle image resolver and is never saved, selected or used for
 * fitment. Its cutout carries its own contact shadow.
 */
function GarageAddHero({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const openGarage = () => {
    triggerHaptic('selection');
    router.navigate('/garage');
  };

  return (
    <GarageHeroCard
      testID="home-garage-card"
      visual={{ kind: 'image', source: emptyGarageArt }}
      groundShadow={false}
      emptyGarage
      onImagePress={openGarage}
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
