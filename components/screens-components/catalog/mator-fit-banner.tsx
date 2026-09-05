import { router } from 'expo-router';
import { Car, ChevronRight, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { getBrand, getEngine, getGeneration, getModel, getTrim } from '@/services/uz-vehicle-catalog';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Vehicle-fit banner (`fitBanner`) — a brand-filled card announcing the
 * vehicle every part is filtered for. Driven entirely by the REAL active
 * vehicle: the garage row when it's loaded, the persisted catalog fitment
 * while the garage is still cold. With no vehicle set it becomes a
 * "select your vehicle" CTA instead of fabricating fitment — worded exactly
 * like `VehicleContextBar`'s unset state so the two surfaces agree. Taps to
 * the Garage tab.
 */
export default function MatorFitBanner() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { currentActiveVehicle, isHydrating } = useActiveVehicle();

  // Nothing to say until the persisted active vehicle has hydrated —
  // rendering early would flash the CTA at users who do have a garage.
  if (isHydrating) return null;

  const label = resolveLabel(currentActiveVehicle);

  const handlePress = () => {
    triggerHaptic('selection');
    router.navigate('/garage');
  };

  return (
    <AppPressableView
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={
        label ? t('catalog.fitBannerAccessibility', { label }) : t('catalog.selectVehiclePrompt')
      }
      androidRipple={false}
      pressedOpacity={0.9}
      row
      align="center"
      gap={10}
      rounded={14}
      px={14}
      py={12}
      style={{ backgroundColor: tokens.brandBg }}
    >
      <AppView center rounded={9} style={{ width: 34, height: 34, backgroundColor: `${tokens.onBrand}22` }}>
        {label ? (
          <Car size={20} strokeWidth={2.2} color={tokens.onBrand} />
        ) : (
          <Plus size={20} strokeWidth={2.4} color={tokens.onBrand} />
        )}
      </AppView>
      <AppView flex={1}>
        <AppText
          family="accent"
          weight="medium"
          style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: tokens.onBrand, opacity: 0.7 }}
        >
          {label ? t('catalog.showingFitmentFor') : t('catalog.fitmentNotSet')}
        </AppText>
        <AppText family="accent" weight="bold" numberOfLines={1} style={{ fontSize: 14, color: tokens.onBrand }}>
          {label ?? t('catalog.selectVehicleTitle')}
        </AppText>
      </AppView>
      <ChevronRight size={20} strokeWidth={2.2} color={tokens.onBrand} style={{ opacity: 0.6 }} />
    </AppPressableView>
  );
}

/**
 * Best label the active vehicle can give us, in order of fidelity:
 * the garage row (year + make + model + trim), then the catalog fitment
 * ids that are persisted even before the garage list loads. `null` when
 * there is no active vehicle at all.
 */
function resolveLabel(active: ReturnType<typeof useActiveVehicle>['currentActiveVehicle']): string | null {
  if (!active) return null;

  const vehicle = active.vehicle;
  if (vehicle) {
    const parts = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean);
    if (parts.length) return parts.join(' ');
  }

  const { fitment } = active;
  const generation = fitment.generationId ? getGeneration(fitment.generationId) : undefined;
  const trim = fitment.trimId ? getTrim(fitment.trimId) : undefined;
  const engine = fitment.engineId ? getEngine(fitment.engineId) : undefined;
  const fromFitment = [
    getBrand(fitment.brandId)?.label,
    getModel(fitment.modelId)?.label,
    generation?.label,
    trim?.label,
    engine?.label,
  ].filter(Boolean);

  return fromFitment.length ? fromFitment.join(' ') : null;
}
