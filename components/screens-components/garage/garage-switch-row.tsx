import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useLanguageContext } from '@/contexts/language.context';
import type { Vehicle } from '@/services/garage-service';
import { formatMileage } from '@/utils/mileage';

import { GarageBrandBadge } from './garage-brand-badge';

export type GarageSwitchRowProps = {
  vehicle: Vehicle;
  /** Sets this vehicle active (primary) and toasts confirmation. */
  onSetActive: (vehicle: Vehicle) => void;
  /** Opens this vehicle's detail screen (edit mileage/plate/colour, delete). */
  onOpenDetail: (id: string) => void;
};

/**
 * A non-active vehicle: its brand badge, the name and `year · trim · mileage`,
 * then two distinct targets.
 *
 * The row body switches this car in. The chevron on the right opens its detail
 * screen, which is the only place a vehicle can be edited or deleted. Without
 * that second target a non-active car was unreachable: you had to make it
 * active first, which changes the fitment used across the whole catalog, just
 * to correct a mileage typo or remove a car you no longer own.
 */
export function GarageSwitchRow({ vehicle, onSetActive, onOpenDetail }: GarageSwitchRowProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { language } = useLanguageContext();

  const name = `${vehicle.make} ${vehicle.model}`;
  const fullName = `${vehicle.year} ${name}`;
  const sub = [
    vehicle.year,
    vehicle.trim,
    formatMileage(vehicle.mileage, t('garage.mileageUnit'), language),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <AppPressableView
      row
      align="center"
      gap={12}
      rounded={12}
      colorName="card"
      borderWidth={1}
      borderName="border"
      androidRipple
      onPress={() => onSetActive(vehicle)}
      accessibilityRole="button"
      accessibilityLabel={t('garage.setActiveVehicle', { vehicle: fullName })}
      style={{ paddingVertical: 12, paddingLeft: 12, minHeight: 48 }}
    >
      <GarageBrandBadge make={vehicle.make} />
      <AppView flex={1} style={{ minWidth: 0 }}>
        <AppText
          family="default"
          weight="semibold"
          colorName="text"
          style={{ fontSize: 14, lineHeight: 20 }}
        >
          {name}
        </AppText>
        {sub ? (
          <AppText textVariant="bodyXs" colorName="textMuted">
            {sub}
          </AppText>
        ) : null}
        <AppText
          family="accent"
          weight="semibold"
          style={{ fontSize: 14, lineHeight: 20, marginTop: 4, color: tokens.brand }}
        >
          {t('garage.setActive')}
        </AppText>
      </AppView>
      <AppPressableView
        onPress={() => onOpenDetail(vehicle.id)}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityLabel={t('garage.openVehicleDetails', { vehicle: fullName })}
        center
        style={{ width: 48, height: 48, flexShrink: 0 }}
      >
        <ChevronRight size={18} strokeWidth={2.2} color={tokens.textMuted} />
      </AppPressableView>
    </AppPressableView>
  );
}

export default GarageSwitchRow;
