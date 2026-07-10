import { router } from 'expo-router';
import { Car, ChevronRight } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Vehicle-fit banner on the Explore landing, per the Mator handoff: a
 * full-width brand-filled card announcing which vehicle every part is being
 * filtered for. Tapping opens the Garage tab to change it. Driven by the REAL
 * active vehicle — renders nothing when the user hasn't set one (guest with an
 * empty garage), so we never show fabricated fitment.
 */
export default function SearchFitBanner() {
  const { tokens } = useThemeContext();
  const { currentActiveVehicle } = useActiveVehicle();

  const vehicle = currentActiveVehicle?.vehicle;
  const label = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
    : null;

  if (!label) return null;

  const handlePress = () => {
    triggerHaptic('selection');
    router.navigate('/garage');
  };

  return (
    <AppView px="lg" pt="lg">
      <AppPressableView
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Showing fitment for ${label}. Change vehicle.`}
        androidRipple={false}
        pressedOpacity={0.9}
        row
        align="center"
        gap="md"
        rounded={16}
        px={14}
        py={14}
        style={{ backgroundColor: tokens.brandBg }}
      >
        <AppView
          center
          rounded={12}
          style={{ width: 40, height: 40, backgroundColor: `${tokens.onBrand}22` }}
        >
          <Car size={20} strokeWidth={2.2} color={tokens.onBrand} />
        </AppView>
        <AppView flex={1} gap={2}>
          <AppText
            family="accent"
            weight="semibold"
            style={{ fontSize: 10.5, letterSpacing: 0.7, color: `${tokens.onBrand}b0` }}
          >
            SHOWING FITMENT FOR
          </AppText>
          <AppText
            textVariant="bodySemibold"
            weight="semibold"
            numberOfLines={1}
            style={{ color: tokens.onBrand }}
          >
            {label}
          </AppText>
        </AppView>
        <ChevronRight size={20} strokeWidth={2.2} color={tokens.onBrand} />
      </AppPressableView>
    </AppView>
  );
}
