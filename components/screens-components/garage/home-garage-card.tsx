import { router } from 'expo-router';
import { ArrowLeftRight } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import GarageAddHero, {
  GarageHeroCard,
  type GarageHeroVisual,
} from '@/components/screens-components/garage/garage-add-hero';
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
import { nearestSwatch } from '@/utils/vehicle-color';
import { resolveVehicleImage } from '@/services/vehicle-images/resolver';
import { chooseVehicleVisual } from '@/services/vehicle-images/vehicle-visual';
import type { VehicleImageState } from '@/services/vehicle-images/image-status';
import { useVehicleImage } from '@/hooks/use-vehicle-image';
import { pictureModelId } from '@/services/vehicle-images/generation';
import VehicleGenerationChoice from '@/components/screens-components/garage/vehicle-generation-choice';
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

/**
 * The selected vehicle's picture: the backend's approved, published image when it
 * has one; else an approved bundled image of exactly this model and generation;
 * else the universal placeholder, saying "preparing" or "no image yet" from the
 * backend's `vehicle_image` status. Never the empty state's decorative car, and
 * never a stand-in model. Reads the garage row when loaded, else the persisted
 * fitment ids. A generic model is pictured as the generation the backend resolved
 * it to; until then it stays the placeholder.
 */
function heroVisual(
  active: ReturnType<typeof useActiveVehicle>['currentActiveVehicle'],
  vehicle: Vehicle | undefined,
  image: VehicleImageState | undefined,
): GarageHeroVisual {
  const resolved = resolveVehicleImage({
    brandId: vehicle?.brandId || active?.fitment.brandId,
    modelId: pictureModelId(vehicle?.modelId || active?.fitment.modelId, vehicle?.generation),
    trimId: vehicle?.trimId ?? active?.fitment.trimId,
    year: vehicle?.year,
    colorHex: vehicle?.colorHex,
  });
  return chooseVehicleVisual(resolved, image);
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
  // Refreshes only while pending, on a backing-off schedule; never blocks the card.
  const image = useVehicleImage(vehicle?.id, vehicle?.image);
  // The saved colour, named as the Garage screen names it. It's the car's real
  // colour even when the picture is the white fallback.
  const colorName = vehicle?.colorHex ? t(nearestSwatch(vehicle.colorHex).labelKey) : '';
  const spec = [summary?.spec, colorName].filter(Boolean).join(' · ');

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

  // No car yet: the decorative empty-garage hero.
  if (!summary) {
    // The Garage screen's own add flow (auth gate first for guests).
    const addVehicle = () => {
      triggerHaptic('selection');
      router.navigate('/garage?add=1');
    };
    return <GarageAddHero onPress={addVehicle} />;
  }

  const visual = heroVisual(currentActiveVehicle, vehicle, image);

  const card = (
    <GarageHeroCard
      testID="home-garage-card"
      visual={visual}
      action={{ testID: 'home-garage-shop-parts', title: t('explore.shopParts'), onPress: shopParts }}
      secondaryAction={
        // Under the car, on the "shop parts" line, in its label's type (the
        // `lg` button's 16px SemiBold) and at its 48pt height. One line: where
        // the slot is narrow the label shrinks instead of wrapping. An app
        // action, not a web link: a swap glyph instead of an underline.
        <AppPressableView
          testID="home-garage-change-vehicle"
          onPress={openGarage}
          androidRipple={false}
          pressedOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('explore.changeVehicleAccessibility', { name: summary.name })}
          row
          align="center"
          gap={6}
          style={{ minHeight: 48, maxWidth: '100%', paddingHorizontal: 8, justifyContent: 'center' }}
        >
          <ArrowLeftRight size={18} strokeWidth={2.4} color={tokens.brandText} />
          {/* `lineHeight: undefined` clears the variant's 20: a hard line
           *  height with `adjustsFontSizeToFit` over-shrinks on iOS (see
           *  `AppPrice`). */}
          <AppText
            textVariant="button"
            weight="semibold"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ flexShrink: 1, minWidth: 0, lineHeight: undefined, color: tokens.brandText }}
          >
            {t('explore.changeVehicle')}
          </AppText>
        </AppPressableView>
      }
    >
      <AppText textVariant="h4" weight="bold" style={{ color: tokens.onVehicleBanner }}>
        {summary.name}
      </AppText>
      {spec ? (
        // The banner's own ink at 70%: secondary to the name, but readable on the mint.
        <AppText textVariant="bodySm" style={{ color: `${tokens.onVehicleBanner}B3` }}>
          {spec}
        </AppText>
      ) : null}
    </GarageHeroCard>
  );

  // A year two generations share: the backend's options, under the card.
  return vehicle?.generation?.status === 'choice_required' ? (
    <AppView gap="sm">
      {card}
      <VehicleGenerationChoice vehicle={vehicle} />
    </AppView>
  ) : (
    card
  );
}

export default memo(HomeGarageCard);
