import { router } from 'expo-router';
import { Car, ChevronRight } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { MATOR_VEHICLES } from '@/mocks/mator-catalog';

/**
 * Vehicle-fit banner (`fitBanner`) — a brand-filled card announcing the
 * vehicle every part is filtered for. Reads the app's active vehicle when
 * present and falls back to the seed 2019 Toyota Camry so the banner always
 * shows (matching the prototype, where fitment is always confirmed). Taps to
 * the Garage tab.
 */
export default function MatorFitBanner() {
  const { tokens } = useThemeContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const active = currentActiveVehicle?.vehicle;
  const seed = MATOR_VEHICLES[0];
  const label = active
    ? `${active.year} ${active.make} ${active.model} ${active.trim ?? ''}`.trim()
    : `${seed.year} ${seed.make} ${seed.model} ${seed.trim}`.trim();

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
      <AppView center rounded={9} style={{ width: 34, height: 34, backgroundColor: `${tokens.onBrand}22` }}>
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
