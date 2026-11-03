import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';
import { colorEnumToHex, nearestSwatch } from '@/utils/vehicle-color';

import { GarageBrandBadge } from './garage-brand-badge';

export type GarageActiveHeroProps = {
  vehicle: Vehicle;
  /** Primary CTA — the parts list for this car. */
  onShopParts: (id: string) => void;
  /** Square tune button — opens the vehicle detail screen. */
  onOpenDetail: (id: string) => void;
};

export function GarageActiveHero({ vehicle, onShopParts, onOpenDetail }: GarageActiveHeroProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  // The colour to show is `color_hex`, not the lossy 4-value `color` enum —
  // reading the enum reported a colour the owner never picked — and the swatch
  // name is translated, not English. Mileage lives on its quick-action tile;
  // trim and VIN on the vehicle-detail screen, one tap away.
  const meta = [
    vehicle.year,
    t(nearestSwatch(vehicle.colorHex ?? colorEnumToHex(vehicle.color)).labelKey),
  ]
    .filter(Boolean)
    .join(' · ');

  // The same banner as Home: every colour comes from the `vehicleBanner*` theme
  // tokens, pale teal in light mode and the elevated card surface in dark mode.
  return (
    <AppView
      rounded={16}
      colorName="vehicleBanner"
      borderWidth={1}
      borderName="vehicleBannerBorder"
      p="lg"
      gap="md"
    >
      {/* The name's column flexes and wraps; the settings button keeps its own
       *  fixed space, so long makes ("Mercedes-Benz") never run under it. */}
      <AppView row align="center" gap="md">
        <GarageBrandBadge make={vehicle.make} />

        <AppView flex={1} style={{ minWidth: 0 }}>
          {/* "Selected", never green: this says which car is chosen, not that
           *  anything has been verified to fit it. */}
          <AppText
            textVariant="bodyXs"
            weight="medium"
            style={{ color: tokens.vehicleBannerMuted }}
          >
            {t('garage.selectedVehicle')}
          </AppText>
          <AppText textVariant="h4" weight="bold" style={{ color: tokens.onVehicleBanner }}>
            {`${vehicle.make} ${vehicle.model}`}
          </AppText>
          {meta ? (
            <AppText textVariant="bodySm" style={{ color: tokens.vehicleBannerMuted }}>
              {meta}
            </AppText>
          ) : null}
        </AppView>

        <AppPressableView
          center
          rounded={12}
          androidRipple={false}
          pressedOpacity={0.7}
          onPress={() => onOpenDetail(vehicle.id)}
          accessibilityRole="button"
          accessibilityLabel={t('garage.vehicleDetails')}
          style={{ alignSelf: 'flex-start', flexShrink: 0, width: 48, height: 48, margin: -8 }}
        >
          <SlidersHorizontal size={20} strokeWidth={2.2} color={tokens.vehicleBannerMuted} />
        </AppPressableView>
      </AppView>

      <AppButton
        title={t('explore.shopParts')}
        kind="brand"
        size="lg"
        fullWidth
        onPress={() => onShopParts(vehicle.id)}
      />
    </AppView>
  );
}

export default GarageActiveHero;
