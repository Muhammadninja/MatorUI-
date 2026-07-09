import { CarFront } from 'lucide-react-native';

import { RADIUS_PILL, RADIUS_SHEET } from '@/components/screens-components/search/radii';
import AppImage from '@/components/shared/app-image';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';

const IMAGE_HEIGHT = 130;

export type GaragePrimaryVehicleCardProps = {
  vehicle: Vehicle;
  onOpenDetail?: (id: string) => void;
  onFindParts?: (id: string) => void;
  onLogService?: (id: string) => void;
  /** Hero image URL. When omitted, falls back to a seeded Picsum placeholder. */
  image?: string;
};

function formatMileage(km?: number): string {
  if (!km && km !== 0) return '';
  return `${km.toLocaleString('en-US')} mi`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function GaragePrimaryVehicleCard({
  vehicle,
  onOpenDetail,
  onFindParts,
  image,
}: GaragePrimaryVehicleCardProps) {
  const { tokens } = useThemeContext();

  const headline = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toUpperCase();
  const subParts = [
    vehicle.trim,
    vehicle.color ? titleCase(vehicle.color) : undefined,
    formatMileage(vehicle.mileage) || undefined,
  ].filter(Boolean);
  const subline = subParts.join(' · ');

  const source =
    image && image.length > 0
      ? image
      : `https://picsum.photos/seed/${vehicle.id}/800/400`;

  return (
    <AppView
      rounded={18}
      colorName="card"
      borderName="border"
      borderWidth={1}
      style={{ overflow: 'hidden' }}
    >
      {/* Image with ACTIVE pill overlay */}
      <AppView style={{ position: 'relative' }}>
        <AppImage
          source={source}
          height={IMAGE_HEIGHT}
          contentFit="cover"
          priority="high"
          cachePolicy="memory-disk"
          transition={180}
          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo`}
          fallback={
            <AppView flex={1} center colorName="backgroundSecondary">
              <CarFront size={36} strokeWidth={2} color={tokens.gray400} />
            </AppView>
          }
        />
        {/* ACTIVE pill overlay */}
        <AppView
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
          }}
        >
          <AppView
            rounded={RADIUS_PILL}
            px={10}
            py={4}
            colorName="brand"
          >
            <AppText
              family="accent"
              weight="bold"
              colorName="onBrand"
              style={{ fontSize: 10, letterSpacing: 0.8 }}
              transform="uppercase"
            >
              Active
            </AppText>
          </AppView>
        </AppView>
      </AppView>

      {/* Vehicle info */}
      <AppView px={16} pt={14} pb={16} gap={4}>
        <AppText
          family="heading"
          weight="bold"
          colorName="text"
          numberOfLines={1}
          style={{ fontSize: 18, lineHeight: 24 }}
        >
          {headline}
        </AppText>
        {subline ? (
          <AppText textVariant="bodySm" colorName="textMuted" numberOfLines={1}>
            {subline}
          </AppText>
        ) : null}
      </AppView>

      {/* Action buttons */}
      <AppView row gap={10} px={16} pb={16}>
        <AppView flex={1}>
          <AppButton
            title="View parts"
            kind="brand"
            size="md"
            fullWidth
            onPress={() => onFindParts?.(vehicle.id)}
          />
        </AppView>
        <AppView flex={1}>
          <AppButton
            title="Details"
            kind="secondary"
            variant="outline"
            size="md"
            fullWidth
            onPress={() => onOpenDetail?.(vehicle.id)}
          />
        </AppView>
      </AppView>
    </AppView>
  );
}

export default GaragePrimaryVehicleCard;
