import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Persistent vehicle-context bar shown atop every catalog view. Reads the
 * active vehicle: a green "Fitting parts for …" status when set, or an
 * amber "Select a vehicle …" warning that routes to the Garage otherwise.
 */
function VehicleContextBar() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const v = currentActiveVehicle?.vehicle;

  if (v) {
    const label = `${v.year} ${v.make} ${v.model} ${v.trim ?? ''}`.trim();
    return (
      <AppPressableView
        testID="vehicle-fitment-bar"
        onPress={() => router.navigate('/garage')}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityLabel={t('catalog.fittingPartsAccessibility', { label })}
        row
        align="center"
        gap={10}
        px={16}
        py={12}
        rounded={14}
        colorName="card"
        borderWidth={1}
        borderName="border"
      >
        <AppView testID="fitment-status-indicator" rounded={999} style={{ width: 8, height: 8, backgroundColor: tokens.success }} />
        <AppView flex={1}>
          <AppText
            family="accent"
            weight="medium"
            style={{ fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase', color: tokens.textMuted }}
          >
            {t('catalog.fittingPartsFor')}
          </AppText>
          <AppText family="accent" weight="bold" numberOfLines={1} style={{ fontSize: 13.5, color: tokens.text }}>
            {label}
          </AppText>
        </AppView>
        <ChevronRight size={18} strokeWidth={2.2} color={tokens.textMuted} />
      </AppPressableView>
    );
  }

  return (
    <AppPressableView
      onPress={() => router.navigate('/garage')}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityLabel={t('catalog.selectVehiclePrompt')}
      row
      align="center"
      gap={10}
      px={16}
      py={12}
      rounded={14}
      borderWidth={1}
      style={{ borderColor: tokens.warning, backgroundColor: `${tokens.warning}1a` }}
    >
      <AppView rounded={999} style={{ width: 8, height: 8, backgroundColor: tokens.warning }} />
      <AppText family="accent" weight="semibold" numberOfLines={2} style={{ flex: 1, fontSize: 13, color: tokens.text }}>
        {t('catalog.selectVehiclePrompt')}
      </AppText>
      <ChevronRight size={18} strokeWidth={2.2} color={tokens.text} />
    </AppPressableView>
  );
}

export default memo(VehicleContextBar);
