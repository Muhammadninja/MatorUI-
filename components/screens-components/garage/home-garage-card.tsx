import { router } from 'expo-router';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import GarageAddHero, {
  GarageHeroCard,
  type GarageHeroVisual,
} from '@/components/screens-components/garage/garage-add-hero';
import { carBodyForVehicle } from '@/components/screens-components/garage/car-body';
import type { CarBody } from '@/components/shared/mator-icons';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useGarage } from '@/hooks/use-garage';
import {
  getBrand,
  getEngine,
  getGeneration,
  getModel,
  getTrim,
} from '@/services/uz-vehicle-catalog';
import type { Vehicle } from '@/services/garage-service';
import type { BodyType } from '@/services/vehicle-images/manifest';
import { parseHex } from '@/services/vehicle-images/paint';
import { resolveVehicleImage } from '@/services/vehicle-images/resolver';
import { triggerHaptic } from '@/utils/haptics';

/** Reserved while the persisted vehicle hydrates, so nothing below the card
 *  jumps when it resolves. Matches a one-line name + year + button. */
const SKELETON_HEIGHT = 140;

type VehicleSummary = {
  name: string;
  spec: string;
  make?: string;
  model?: string;
  year?: string;
};

/**
 * The garage row when it has loaded, else the persisted catalog fitment ids —
 * which resolve before the list does, so the card names the car instead of
 * asking someone who has one to add it.
 */
function summarize(
  active: ReturnType<typeof useActiveVehicle>['currentActiveVehicle'],
  vehicle: Vehicle | undefined,
) {
  if (!active) return null;
  const { fitment } = active;
  if (vehicle) {
    const name = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
    if (name) {
      const spec = [vehicle.year, vehicle.trim].filter(Boolean).join(' · ');
      return {
        name,
        spec,
        make: vehicle.make,
        model: vehicle.model,
        year: String(vehicle.year),
      } satisfies VehicleSummary;
    }
  }
  const make = getBrand(fitment.brandId)?.label;
  const model = getModel(fitment.modelId)?.label;
  const name = [make, model].filter(Boolean).join(' ');
  if (!name) return null;
  const spec = [
    fitment.generationId ? getGeneration(fitment.generationId)?.label : undefined,
    fitment.trimId ? getTrim(fitment.trimId)?.label : undefined,
    fitment.engineId ? getEngine(fitment.engineId)?.label : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return { name, spec, make, model } satisfies VehicleSummary;
}

const SILHOUETTE: Record<BodyType, CarBody> = {
  sedan: 'sedan',
  hatchback: 'hatchback',
  suv: 'suv',
  mpv: 'suv',
  microvan: 'suv',
  pickup: 'truck',
};

/**
 * The selected vehicle's picture: an approved image of exactly this model and
 * generation, else a neutral silhouette. Never the empty state's decorative
 * Cobalt. Reads the garage row when loaded, else the persisted fitment ids.
 */
function heroVisual(
  active: ReturnType<typeof useActiveVehicle>['currentActiveVehicle'],
  vehicle: Vehicle | undefined,
): GarageHeroVisual & { shownInWhite?: boolean } {
  const resolved = resolveVehicleImage({
    brandId: vehicle?.brandId || active?.fitment.brandId,
    modelId: vehicle?.modelId || active?.fitment.modelId,
    trimId: vehicle?.trimId ?? active?.fitment.trimId,
    year: vehicle?.year,
    colorHex: vehicle?.colorHex,
  });
  if (resolved.kind === 'image') {
    // The car has a real saved colour the image doesn't show (another paint, or
    // one outside the eight): say so rather than let white pass as their colour.
    const shownInWhite = !resolved.paintMatched && parseHex(vehicle?.colorHex) !== null;
    return { kind: 'image', source: resolved.source, shownInWhite };
  }
  const body = resolved.bodyType
    ? SILHOUETTE[resolved.bodyType]
    : carBodyForVehicle({ modelId: vehicle?.modelId || active?.fitment.modelId, model: vehicle?.model ?? '' });
  return { kind: 'placeholder', body };
}

/**
 * The selected-vehicle banner at the top of Explore. It states which car is selected and
 * nothing about compatibility: choosing a car does not establish that a part
 * fits it, so no state here is green.
 *
 * Every action goes to a destination the app already had: the Garage screen
 * (which owns the guest gate and the add-vehicle routes) and the same
 * `/vehicle-parts` list the Garage hero's "shop parts" opens.
 */
function HomeGarageCard() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { currentActiveVehicle, isHydrating } = useActiveVehicle();

  // Reading the garage here loads it from launch: until something does, the
  // active vehicle is only its persisted fitment ids, which have no year.
  const { vehicles } = useGarage();
  const vehicle =
    currentActiveVehicle?.vehicle ?? vehicles.find((v) => v.id === currentActiveVehicle?.vehicleId);
  const summary = isHydrating ? null : summarize(currentActiveVehicle, vehicle);

  const openGarage = () => {
    triggerHaptic('selection');
    router.navigate('/garage');
  };

  const shopParts = () => {
    if (!summary) return;
    triggerHaptic('selection');
    router.navigate({
      pathname: '/vehicle-parts',
      params: {
        make: summary.make,
        model: summary.model,
        year: summary.year,
        label: summary.name,
      },
    });
  };

  if (isHydrating) {
    return (
      <AppView
        testID="home-garage-card-loading"
        rounded={16}
        colorName="vehicleBanner"
        borderWidth={1}
        borderName="vehicleBannerBorder"
        accessibilityElementsHidden
        style={{ minHeight: SKELETON_HEIGHT }}
      />
    );
  }

  // No car yet: the Cobalt hero, opening the same Garage destination.
  if (!summary) return <GarageAddHero onPress={openGarage} />;

  const visual = heroVisual(currentActiveVehicle, vehicle);

  return (
    <GarageHeroCard
      testID="home-garage-card"
      visual={visual}
      action={{ testID: 'home-garage-shop-parts', title: t('explore.shopParts'), onPress: shopParts }}
    >
      <AppText textVariant="h4" weight="bold" style={{ color: tokens.onVehicleBanner }}>
        {summary.name}
      </AppText>
      {summary.spec ? (
        <AppText textVariant="bodySm" style={{ color: tokens.vehicleBannerMuted }}>
          {summary.spec}
        </AppText>
      ) : null}
      {visual.kind === 'image' && visual.shownInWhite ? (
        <AppText testID="home-garage-image-in-white" textVariant="caption" style={{ color: tokens.vehicleBannerMuted }}>
          {t('explore.vehicleImageInWhite')}
        </AppText>
      ) : null}
      <AppPressableView
        onPress={openGarage}
        androidRipple={false}
        pressedOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('explore.changeVehicleAccessibility', { name: summary.name })}
        style={{ alignSelf: 'flex-start', minHeight: 48, minWidth: 48, justifyContent: 'center' }}
      >
        <AppText
          textVariant="bodySm"
          weight="semibold"
          style={{ color: tokens.brandText, textDecorationLine: 'underline' }}
        >
          {t('explore.changeVehicle')}
        </AppText>
      </AppPressableView>
    </GarageHeroCard>
  );
}

export default memo(HomeGarageCard);
