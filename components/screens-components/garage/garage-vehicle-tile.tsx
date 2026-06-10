import { ScanLine, Star } from 'lucide-react-native';

import { RADIUS_MEDIA, RADIUS_PILL, RADIUS_SHEET } from '@/components/screens-components/search/radii';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';

export type GarageVehicleTileProps = {
  vehicle: Vehicle;
  onOpenDetail?: (id: string) => void;
  onSetPrimary?: (id: string) => void;
  /** Shortcut to the catalog filtered by this vehicle. Surfaced as a
   *  discoverable inline button on the tile so secondary vehicles don't
   *  require a detail-screen detour to reach the marketplace. */
  onFindParts?: (id: string) => void;
};

function formatMileage(mi?: number): string {
  if (!mi && mi !== 0) return '— mi';
  return `${mi.toLocaleString('en-US')} mi`;
}

export function GarageVehicleTile({
  vehicle,
  onOpenDetail,
  onSetPrimary,
  onFindParts,
}: GarageVehicleTileProps) {
  const { tokens } = useThemeContext();

  const headline = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const subline = [vehicle.trim, formatMileage(vehicle.mileage)].filter(Boolean).join(' · ');

  return (
    <AppPressableView
      rounded={RADIUS_SHEET}
      colorName="card"
      borderName="border"
      borderWidth={1}
      androidRipple
      onPress={() => onOpenDetail?.(vehicle.id)}
      accessibilityRole="button"
      accessibilityLabel={headline}
      accessibilityHint="Opens vehicle details"
    >
      <AppView row align="center" gap={14} px={16} py={14}>
        <AppView
          center
          rounded={RADIUS_MEDIA}
          colorName="backgroundSecondary"
          borderName="border"
          borderWidth={1}
          style={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <AppText textVariant="bodySemibold" family="heading" colorName="text">
            {vehicle.make.charAt(0)}
          </AppText>
        </AppView>

        <AppView flex={1} gap={2}>
          <AppText textVariant="bodySemibold" colorName="text" numberOfLines={1}>
            {headline}
          </AppText>
          <AppText textVariant="bodyXs" colorName="gray400" numberOfLines={1}>
            {subline}
          </AppText>
        </AppView>

        {/* Star = set as primary. Pinned to the right column so the
         *  affordance is consistent across tiles. Pill shape matches the
         *  Find-parts button next to it. */}
        <AppPressableView
          center
          rounded={RADIUS_PILL}
          colorName="backgroundSecondary"
          borderName="border"
          borderWidth={1}
          onPress={() => onSetPrimary?.(vehicle.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: vehicle.isPrimary }}
          accessibilityLabel={
            vehicle.isPrimary ? 'Already primary vehicle' : 'Set as primary vehicle'
          }
          accessibilityHint={
            vehicle.isPrimary
              ? undefined
              : 'Makes this the default vehicle for fitment filters'
          }
          hitSlop={8}
          style={{ width: 32, height: 32, flexShrink: 0 }}
        >
          <Star
            size={14}
            strokeWidth={2}
            color={vehicle.isPrimary ? tokens.accolade : tokens.text}
            fill={vehicle.isPrimary ? tokens.accolade : 'transparent'}
          />
        </AppPressableView>

        {/* Find parts shortcut — replaces the previously decorative
         *  ChevronRight. Routes to the catalog filtered by this vehicle
         *  so a user with 3+ vehicles can shop for a specific car without
         *  detouring through the detail screen. Brand-styled to read as
         *  the marketplace action. */}
        <AppPressableView
          center
          rounded={RADIUS_PILL}
          colorName="brand"
          onPress={() => onFindParts?.(vehicle.id)}
          accessibilityRole="button"
          accessibilityLabel={`Find parts for ${headline}`}
          accessibilityHint="Opens the catalog filtered by this vehicle"
          hitSlop={8}
          style={{ width: 32, height: 32, flexShrink: 0 }}
        >
          <ScanLine size={14} strokeWidth={2} color={tokens.onBrand} />
        </AppPressableView>
      </AppView>
    </AppPressableView>
  );
}

export default GarageVehicleTile;
