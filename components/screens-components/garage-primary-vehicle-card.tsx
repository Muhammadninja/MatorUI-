import { CarFront, ChevronRight, Gauge, ScanLine, Wrench } from 'lucide-react-native';
import type { ReactNode } from 'react';

import AppImage from '@/components/shared/app-image';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';

const MEDIA_HEIGHT = 160;

export type GaragePrimaryVehicleCardProps = {
  vehicle: Vehicle;
  onOpenDetail?: (id: string) => void;
  onFindParts?: (id: string) => void;
  onLogService?: (id: string) => void;
};

function formatMileage(mi?: number): string {
  if (!mi && mi !== 0) return '— mi';
  return `${mi.toLocaleString('en-US')} mi`;
}

export function GaragePrimaryVehicleCard({
  vehicle,
  onOpenDetail,
  onFindParts,
  onLogService,
}: GaragePrimaryVehicleCardProps) {
  const { tokens } = useThemeContext();

  const headline = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const subline = [vehicle.trim, vehicle.nickname].filter(Boolean).join(' · ') || 'Primary vehicle';

  return (
    <AppView gap={14} mt={55} >
      <AppPressableView
        rounded={28}
        colorName="card"
        borderName="border"
        borderWidth={1}
        androidRipple={false}
        pressedOpacity={0.96}
        accessibilityLabel={`Open ${headline} details`}
        onPress={() => onOpenDetail?.(vehicle.id)}
      >
        <AppView gap={20} p={20}>
          <AppView row align="center" justify="space-between" gap={10}>
            <AppView row align="center" gap={10} flex={1}>
              <AppView
                center
                rounded={999}
                colorName="secondary"
                style={{ width: 28, height: 28, flexShrink: 0 }}
              >
                <AppText textVariant="caption" weight="bold" colorName="onSecondary">
                  P
                </AppText>
              </AppView>
              <AppText
                textVariant="caption"
                family="accent"
                colorName="gray400"
                transform="uppercase"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ flexShrink: 1 }}
              >
                Primary vehicle
              </AppText>
            </AppView>
            <AppView style={{ flexShrink: 0 }}>
              <ChevronRight size={18} strokeWidth={2.2} color={tokens.gray400} />
            </AppView>
          </AppView>

          <VehicleMedia vehicleId={vehicle.id} headline={headline} />

          <AppView gap={4}>
            <AppText textVariant="title" family="heading" weight="bold" colorName="text">
              {headline}
            </AppText>
            <AppText textVariant="bodySm" colorName="gray400" numberOfLines={1}>
              {subline}
            </AppText>
          </AppView>

          <AppView
            row
            gap={12}
            py={12}
            style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: tokens.divider,
            }}
          >
            <MetaCell
              icon={<Gauge size={16} strokeWidth={2.1} color={tokens.text} />}
              label="Mileage"
              value={formatMileage(vehicle.mileage)}
            />
            <AppView style={{ width: 1, backgroundColor: tokens.divider }} />
            <MetaCell
              icon={<ScanLine size={16} strokeWidth={2.1} color={tokens.text} />}
              label="Plate"
              value={vehicle.plate ?? '—'}
            />
          </AppView>
        </AppView>
      </AppPressableView>

      <AppView row gap={10}>
        <ActionPill
          label="Parts"
          icon={<ScanLine size={16} strokeWidth={2.2} color={tokens.onBrand} />}
          onPress={() => onFindParts?.(vehicle.id)}
          primary
        />
        <ActionPill
          label="Service"
          icon={<Wrench size={16} strokeWidth={2.2} color={tokens.text} />}
          onPress={() => onLogService?.(vehicle.id)}
        />
      </AppView>
    </AppView>
  );
}

type VehicleMediaProps = {
  vehicleId: string;
  headline: string;
};

function VehicleMedia({ vehicleId, headline }: VehicleMediaProps) {
  const { tokens } = useThemeContext();
  return (
    <AppImage
      source={`https://picsum.photos/seed/${vehicleId}/800/400`}
      height={MEDIA_HEIGHT}
      rounded={16}
      borderName="border"
      borderWidth={1}
      placeholderColorName="backgroundSecondary"
      contentFit="cover"
      priority="high"
      cachePolicy="memory-disk"
      transition={180}
      alt={`${headline} photo`}
      fallback={
        <AppView flex={1} center>
          <CarFront size={36} strokeWidth={1.6} color={tokens.gray400} />
        </AppView>
      }
    />
  );
}

type MetaCellProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function MetaCell({ icon, label, value }: MetaCellProps) {
  return (
    <AppView flex={1} gap={6}>
      <AppView row align="center" gap={6}>
        <AppView style={{ flexShrink: 0 }}>{icon}</AppView>
        <AppText
          textVariant="caption"
          family="accent"
          colorName="gray400"
          transform="uppercase"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ flexShrink: 1 }}
        >
          {label}
        </AppText>
      </AppView>
      <AppText textVariant="bodySemibold" colorName="text" numberOfLines={1}>
        {value}
      </AppText>
    </AppView>
  );
}

type ActionPillProps = {
  label: string;
  icon: ReactNode;
  onPress?: () => void;
  primary?: boolean;
};

function ActionPill({ label, icon, onPress, primary }: ActionPillProps) {
  return (
    <AppPressableView
      flex={1}
      rounded={999}
      colorName={primary ? 'brand' : 'card'}
      borderName={primary ? undefined : 'border'}
      borderWidth={primary ? 0 : 1}
      androidRipple
      onPress={onPress}
      accessibilityLabel={label}
    >
      <AppView row center gap={8} px={10} py={12}>
        <AppView style={{ flexShrink: 0 }}>{icon}</AppView>
        <AppText
          textVariant="buttonSm"
          family="accent"
          weight="semibold"
          colorName={primary ? 'onBrand' : 'text'}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ flexShrink: 1 }}
        >
          {label}
        </AppText>
      </AppView>
    </AppPressableView>
  );
}

export default GaragePrimaryVehicleCard;
