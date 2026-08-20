import { useTranslation } from 'react-i18next';

import { CarIcon } from '@/components/shared/mator-icons';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';

import { carBodyForVehicle } from './car-body';

export type GarageSwitchRowProps = {
  vehicle: Vehicle;
  /** Sets this vehicle active (primary) and toasts confirmation. */
  onSetActive: (vehicle: Vehicle) => void;
};

function formatMileage(km: number | undefined, unit: string): string {
  if (km === undefined || km === null) return '';
  return `${km.toLocaleString('en-US')} ${unit}`;
}

/**
 * A non-active vehicle, rendered as a tap-to-switch row: a `bg2` tile
 * holding the car silhouette, the name + `trim · mileage`, and a muted
 * "Set active" affordance on the right. The whole row is the target.
 */
export function GarageSwitchRow({ vehicle, onSetActive }: GarageSwitchRowProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const body = carBodyForVehicle(vehicle);
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const sub = [vehicle.trim, formatMileage(vehicle.mileage, t('garage.mileageUnit'))]
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
        <AppText family="default" weight="semibold" colorName="text" numberOfLines={1} style={{ fontSize: 14.5 }}>
          {name}
        </AppText>
        {sub ? (
          <AppText family="default" colorName="textMuted" numberOfLines={1} style={{ fontSize: 12, marginTop: 2 }}>
            {sub}
          </AppText>
        ) : null}
      </AppView>
      <AppText family="accent" weight="bold" colorName="textMuted" numberOfLines={1} style={{ fontSize: 11.5, flexShrink: 0 }}>
        {t('garage.setActive')}
      </AppText>
    </AppPressableView>
  );
}

export default GarageSwitchRow;
