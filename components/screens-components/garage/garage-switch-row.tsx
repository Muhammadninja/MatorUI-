import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';

import { CarIcon } from '@/components/shared/mator-icons';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useLanguageContext } from '@/contexts/language.context';
import type { Vehicle } from '@/services/garage-service';
import { formatMileage } from '@/utils/mileage';

import { carBodyForVehicle } from './car-body';

export type GarageSwitchRowProps = {
  vehicle: Vehicle;
  /** Sets this vehicle active (primary) and toasts confirmation. */
  onSetActive: (vehicle: Vehicle) => void;
  /** Opens this vehicle's detail screen (edit mileage/plate/colour, delete). */
  onOpenDetail: (id: string) => void;
};

/**
 * A non-active vehicle: a `bg2` tile holding the car silhouette, the name and
 * `trim · mileage`, then two distinct targets.
 *
 * The row body switches this car in. The chevron on the right opens its detail
 * screen, which is the only place a vehicle can be edited or deleted. Without
 * that second target a non-active car was unreachable: you had to make it
 * active first, which changes the fitment used across the whole catalog, just
 * to correct a mileage typo or remove a car you no longer own.
 */
export function GarageSwitchRow({
  vehicle,
  onSetActive,
  onOpenDetail,
}: GarageSwitchRowProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { language } = useLanguageContext();

  const body = carBodyForVehicle(vehicle);
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const sub = [vehicle.trim, formatMileage(vehicle.mileage, t('garage.mileageUnit'), language)]
    .filter(Boolean)
    .join(' · ');

  return (
    <AppPressableView
      row
      align="center"
      gap={13}
      rounded={16}
      colorName="card"
      androidRipple
      onPress={() => onSetActive(vehicle)}
      accessibilityRole="button"
      accessibilityLabel={t('garage.setActiveVehicle', { vehicle: name })}
      p={13}
    >
      <AppView center colorName="backgroundSecondary" style={{ width: 52, height: 44, borderRadius: 12, flexShrink: 0 }}>
        <CarIcon body={body} size={38} color={tokens.textMuted} />
      </AppView>
      <AppView flex={1} style={{ minWidth: 0 }}>
        <AppText family="default" weight="semibold" colorName="text" style={{ fontSize: 14.5 }}>
          {name}
        </AppText>
        {sub ? (
          <AppText family="default" colorName="textMuted" style={{ fontSize: 12, marginTop: 2 }}>
            {sub}
          </AppText>
        ) : null}
      </AppView>
      <AppText family="accent" weight="bold" colorName="textMuted" style={{ fontSize: 11.5, flexShrink: 1, maxWidth: 96, textAlign: 'right' }}>
        {t('garage.setActive')}
      </AppText>
      <AppPressableView
        onPress={() => onOpenDetail(vehicle.id)}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityLabel={t('garage.openVehicleDetails', { vehicle: name })}
        // Generous hit area around a small glyph, so the chevron does not
        // steal taps meant for the row.
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
        center
        style={{ width: 24, height: 32, flexShrink: 0 }}
      >
        <ChevronRight size={18} strokeWidth={2.2} color={tokens.textMuted} />
      </AppPressableView>
    </AppPressableView>
  );
}

export default GarageSwitchRow;
