import { useTranslation } from 'react-i18next';
import { BadgeCheck } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';

export type GarageFitRowProps = {
  /** The car fitment is currently resolved against. */
  vehicle?: Vehicle;
};

/**
 * Borderless reassurance row: fitment is on, and THIS is the car it uses.
 *
 * It names the vehicle rather than making a bare claim. The old copy
 * ("Every price and part is checked against this car") was unverifiable from
 * the screen and easy to disprove, since the catalog is not wholesale filtered
 * by the garage. What is true is narrower and worth stating precisely: the
 * active car drives the per-item fit check on product rows and item detail
 * (`useActiveVehicle`), and rides along on the orders you place. Printing the
 * car's name makes the claim checkable at a glance.
 */
export function GarageFitRow({ vehicle }: GarageFitRowProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView row align="center" gap={11} rounded={16} colorName="card" style={{ paddingVertical: 13, paddingHorizontal: 14 }}>
      {/* Success glyph medallion — the theme's `successSoft` wash (16% dark /
       *  10% light, the same values this row used to hand-build per scheme). */}
      <AppView center style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tokens.successSoft, flexShrink: 0 }}>
        <BadgeCheck size={18} strokeWidth={2.2} color={tokens.success} />
      </AppView>
      <AppView flex={1} style={{ minWidth: 0 }}>
        <AppText family="default" weight="semibold" colorName="text" numberOfLines={1} style={{ fontSize: 13.5 }}>
          {vehicle
            ? t('garage.fitFilterOnVehicle', {
                vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
              })
            : t('garage.fitFilterOn')}
        </AppText>
        <AppText family="default" colorName="textMuted" numberOfLines={2} style={{ fontSize: 12, marginTop: 1 }}>
          {t('garage.fitFilterBody')}
        </AppText>
      </AppView>
    </AppView>
  );
}

export default GarageFitRow;
