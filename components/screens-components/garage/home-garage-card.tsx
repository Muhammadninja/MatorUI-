import { router } from 'expo-router';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';

import GarageBrandBadge from '@/components/screens-components/garage/garage-brand-badge';
import { AppButton } from '@/components/shared/app-button';
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
import { triggerHaptic } from '@/utils/haptics';

/** Reserved while the persisted vehicle hydrates, so nothing below the card
 *  jumps when it resolves. Matches a one-line name + year + button. */
const SKELETON_HEIGHT = 140;
const LOGO_CHIP_SIZE = 48;

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
 * The selected-vehicle banner at the top of Explore. It states which car is selected and
 * nothing about compatibility: choosing a car does not establish that a part
 * fits it, so no state here is green.
 *
 * Every action goes to a destination the app already had: the Garage screen
 * (which owns the guest gate and the add-vehicle routes) and the same
 * `/vehicle-parts` list the Garage hero's "shop parts" opens.
 */
function HomeGarageCard() {
  const { fontScale } = useWindowDimensions();
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

  // At large text the row stacks, or the name breaks mid-word beside "change".
  const stacked = fontScale >= 1.3;

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

  return (
    <AppView
      testID="home-garage-card"
      rounded={16}
      colorName="vehicleBanner"
      borderWidth={1}
      borderName="vehicleBannerBorder"
      p="lg"
      gap="md"
    >
      {/* The name's column flexes and wraps; "change" keeps its own fixed space, so
       *  they can't collide however long the name or narrow the phone. */}
      <AppView row={!stacked} align={stacked ? 'flex-start' : 'center'} gap="md">
        {summary?.make ? <GarageBrandBadge make={summary.make} size={LOGO_CHIP_SIZE} /> : null}

        <AppView style={stacked ? { alignSelf: 'stretch' } : { flex: 1, minWidth: 0 }}>
          <AppText textVariant="h4" weight="bold" style={{ color: tokens.onVehicleBanner }}>
            {summary ? summary.name : t('explore.addVehicleTitle')}
          </AppText>
          {summary ? (
            summary.spec ? (
              <AppText textVariant="bodySm" style={{ color: tokens.vehicleBannerMuted }}>
                {summary.spec}
              </AppText>
            ) : null
          ) : (
            <AppText textVariant="bodySm" style={{ color: tokens.vehicleBannerMuted }}>
              {t('explore.addVehicleBody')}
            </AppText>
          )}
        </AppView>

        {summary ? (
          <AppPressableView
            onPress={openGarage}
            androidRipple={false}
            pressedOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('explore.changeVehicleAccessibility', { name: summary.name })}
            center
            style={{
              alignSelf: 'flex-start',
              flexShrink: 0,
              minHeight: 48,
              minWidth: 48,
              marginTop: stacked ? 0 : -12,
            }}
          >
            <AppText
              textVariant="bodySm"
              weight="semibold"
              style={{ color: tokens.brandText, textDecorationLine: 'underline' }}
            >
              {t('explore.changeVehicle')}
            </AppText>
          </AppPressableView>
        ) : null}
      </AppView>

      <AppButton
        testID={summary ? 'home-garage-shop-parts' : 'home-garage-add-vehicle'}
        title={summary ? t('explore.shopParts') : t('explore.addVehicleAction')}
        kind="brand"
        size="lg"
        fullWidth
        onPress={summary ? shopParts : openGarage}
      />
    </AppView>
  );
}

export default memo(HomeGarageCard);
