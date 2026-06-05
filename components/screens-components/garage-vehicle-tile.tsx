import { ChevronRight, Star } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';

export type GarageVehicleTileProps = {
  vehicle: Vehicle;
  onOpenDetail?: (id: string) => void;
  onSetPrimary?: (id: string) => void;
};

function formatMileage(mi?: number): string {
  if (!mi && mi !== 0) return '— mi';
  return `${mi.toLocaleString('en-US')} mi`;
}

export function GarageVehicleTile({
  vehicle,
  onOpenDetail,
  onSetPrimary,
}: GarageVehicleTileProps) {
  const { tokens } = useThemeContext();

  const headline = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const subline = [vehicle.trim, formatMileage(vehicle.mileage)].filter(Boolean).join(' · ');

  return (
    <AppPressableView
      rounded={20}
      colorName="card"
      borderName="border"
      borderWidth={1}
      androidRipple
      onPress={() => onOpenDetail?.(vehicle.id)}
      accessibilityLabel={`Open ${headline}`}
    >
      <AppView row align="center" gap={14} px={16} py={14}>
        <AppView
          center
          rounded={14}
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

        <AppPressableView
          center
          rounded={999}
          colorName="backgroundSecondary"
          borderName="border"
          borderWidth={1}
          onPress={() => onSetPrimary?.(vehicle.id)}
          accessibilityLabel="Set as primary"
          hitSlop={8}
          style={{ width: 32, height: 32, flexShrink: 0 }}
        >
          <Star size={14} strokeWidth={2.1} color={tokens.text} />
        </AppPressableView>

        <AppView style={{ flexShrink: 0 }}>
          <ChevronRight size={18} strokeWidth={2.2} color={tokens.gray400} />
        </AppView>
      </AppView>
    </AppPressableView>
  );
}

export default GarageVehicleTile;
