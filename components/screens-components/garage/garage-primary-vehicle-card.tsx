import { CarFront, MoreVertical } from 'lucide-react-native';

import { RADIUS_PILL } from '@/components/screens-components/search/radii';
import AppImage from '@/components/shared/app-image';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';

export type GaragePrimaryVehicleCardProps = {
  vehicle: Vehicle;
  onOpenDetail?: (id: string) => void;
  /** Real vehicle photo URL. When absent, a car placeholder icon is shown. */
  image?: string;
};

function formatMileage(km?: number): string {
  if (!km && km !== 0) return '';
  return `${km.toLocaleString('en-US')} mi`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Neutral tile with a centered car icon — used when the vehicle has no real
 *  photo (and as the image load-failure fallback). */
function CarPlaceholder({ color }: { color: string }) {
  return (
    <AppView flex={1} center colorName="backgroundSecondary">
      <CarFront size={34} strokeWidth={1.8} color={color} />
    </AppView>
  );
}

export function GaragePrimaryVehicleCard({
  vehicle,
  onOpenDetail,
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
  const hasImage = !!(image && image.length > 0);

  return (
    <AppView
      row
      rounded={18}
      colorName="card"
      borderName="border"
      borderWidth={1}
      style={{ overflow: 'hidden' }}
    >
      {/* Image — left column, ~30% of the card width. Car placeholder when the
          vehicle has no real photo. */}
      <AppView style={{ width: '30%', minHeight: 120 }}>
        {hasImage ? (
          <AppImage
            source={image}
            width="100%"
            height="100%"
            contentFit="cover"
            priority="high"
            cachePolicy="memory-disk"
            transition={180}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo`}
            fallback={<CarPlaceholder color={tokens.gray400} />}
          />
        ) : (
          <CarPlaceholder color={tokens.gray400} />
        )}
      </AppView>

      {/* Details — right column: Active pill, headline, subline, kebab. */}
      <AppView flex={1} row px={14} py={14} gap={10}>
        <AppView flex={1} gap={6}>
          <AppView row>
            <AppView rounded={RADIUS_PILL} px={10} py={4} colorName="brand">
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
          <AppText
            family="heading"
            weight="bold"
            colorName="text"
            numberOfLines={2}
            style={{ fontSize: 17, lineHeight: 22 }}
          >
            {headline}
          </AppText>
          {subline ? (
            <AppText textVariant="bodySm" colorName="textMuted" numberOfLines={2}>
              {subline}
            </AppText>
          ) : null}
        </AppView>
        <AppPressableView
          testID={`vehicle-details-${vehicle.id}`}
          onPress={() => onOpenDetail?.(vehicle.id)}
          center
          rounded={999}
          borderWidth={1}
          borderName="border"
          accessibilityRole="button"
          accessibilityLabel="Vehicle details"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={{ width: 40, height: 40 }}
        >
          <MoreVertical size={20} strokeWidth={2.2} color={tokens.text} />
        </AppPressableView>
      </AppView>
    </AppView>
  );
}

export default GaragePrimaryVehicleCard;
