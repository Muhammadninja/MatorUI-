import { router } from 'expo-router';
import { Car, ChevronRight } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Vehicle-fit banner from the prototype's `fitBanner()`: a brand-filled card
 * announcing the vehicle every part is filtered for. Reads the app-wide
 * active-vehicle context and renders nothing while it's still hydrating or
 * when no vehicle is active (none added yet, or the full row hasn't loaded).
 * Taps to the Garage tab.
 */
export default function HomeFitBanner() {
  const { tokens } = useThemeContext();
  const { currentActiveVehicle, isHydrating } = useActiveVehicle();
  const v = currentActiveVehicle?.vehicle;
  if (isHydrating || !v) return null;
  const label = `${v.year} ${v.make} ${v.model} ${v.trim ?? ''}`.trim();

  return (
    <AppPressableView
      onPress={() => router.push('/garage')}
      accessibilityRole="button"
      accessibilityLabel={`Showing fitment for ${label}. Change vehicle.`}
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
      <AppView
        center
        rounded={9}
        style={{ width: 34, height: 34, backgroundColor: `${tokens.onBrand}22` }}
      >
        <Car size={20} strokeWidth={2.2} color={tokens.onBrand} />
      </AppView>
      <AppView flex={1}>
        <AppText
          family="accent"
          weight="medium"
          style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: tokens.onBrand, opacity: 0.7 }}
        >
          Showing fitment for
        </AppText>
        <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.onBrand }}>
          {label}
        </AppText>
      </AppView>
      <ChevronRight size={20} strokeWidth={2.2} color={tokens.onBrand} style={{ opacity: 0.6 }} />
    </AppPressableView>
  );
}
