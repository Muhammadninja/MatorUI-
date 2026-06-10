import { CarFront, ChevronRight, Gauge, ScanLine, Wrench } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { RADIUS_PILL, RADIUS_SHEET } from '@/components/screens-components/search/radii';
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
  /** Hero image URL. When omitted, the card falls back to a stable
   *  seeded Picsum placeholder so dev environments still get visual
   *  variety. Production should pass `vehicle.images[0]` (or similar)
   *  once the garage transport ships image URLs. */
  image?: string;
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
  image,
}: GaragePrimaryVehicleCardProps) {
  const { tokens } = useThemeContext();

  const headline = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const subline = [vehicle.trim, vehicle.nickname].filter(Boolean).join(' · ') || 'Primary vehicle';

  return (
    <AppView gap={14} mt={55} >
      <AppPressableView
        rounded={RADIUS_SHEET}
        colorName="card"
        borderName="border"
        borderWidth={1}
        androidRipple={false}
        pressedOpacity={0.96}
        accessibilityRole="button"
        accessibilityLabel={`${headline}, primary vehicle`}
        accessibilityHint="Opens vehicle details"
        onPress={() => onOpenDetail?.(vehicle.id)}
      >
        <AppView gap={20} p={20}>
          <AppView row align="center" justify="space-between" gap={10}>
            <AppView row align="center" gap={10} flex={1}>
              <AppView
                center
                rounded={RADIUS_PILL}
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
              <ChevronRight size={18} strokeWidth={2} color={tokens.gray400} />
            </AppView>
          </AppView>

          <VehicleMedia vehicleId={vehicle.id} headline={headline} image={image} />

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
              icon={<Gauge size={16} strokeWidth={2} color={tokens.text} />}
              label="Mileage"
              value={formatMileage(vehicle.mileage)}
            />
            <AppView style={{ width: 1, backgroundColor: tokens.divider }} />
            <MetaCell
              icon={<ScanLine size={16} strokeWidth={2} color={tokens.text} />}
              label="Plate"
              value={vehicle.plate ?? '—'}
            />
          </AppView>
        </AppView>
      </AppPressableView>

      <AppView row gap={10}>
        <ActionPill
          label="Parts"
          icon={<ScanLine size={16} strokeWidth={2} color={tokens.onBrand} />}
          onPress={() => onFindParts?.(vehicle.id)}
          primary
        />
        <ActionPill
          label="Service"
          icon={<Wrench size={16} strokeWidth={2} color={tokens.text} />}
          onPress={() => onLogService?.(vehicle.id)}
        />
      </AppView>
    </AppView>
  );
}

type VehicleMediaProps = {
  vehicleId: string;
  headline: string;
  image?: string;
};

function VehicleMedia({ vehicleId, headline, image }: VehicleMediaProps) {
  const { tokens } = useThemeContext();
  // Prefer the explicit URL. Fall back to a seeded Picsum so dev gets
  // consistent-but-varied placeholders; empty string counts as "no
  // image" so backends sending '' instead of null don't break the chain.
  const source =
    image && image.length > 0
      ? image
      : `https://picsum.photos/seed/${vehicleId}/800/400`;
  return (
    <AppImage
      source={source}
      height={MEDIA_HEIGHT}
      rounded={RADIUS_SHEET}
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
          <CarFront size={36} strokeWidth={2} color={tokens.gray400} />
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
      rounded={RADIUS_PILL}
      colorName={primary ? 'brand' : 'card'}
      borderName={primary ? undefined : 'border'}
      borderWidth={primary ? 0 : 1}
      androidRipple
      onPress={onPress}
      accessibilityRole="button"
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
