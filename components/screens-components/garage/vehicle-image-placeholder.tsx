import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import {
  placeholderMessageKey,
  type VehicleImageStage,
  type VehicleImageStatus,
} from '@/services/vehicle-images/image-status';

import universalPlaceholderArt from '@/assets/vehicles/placeholder/universal.webp';

/**
 * A ghosted, deliberately generic car for a vehicle with no approved picture
 * yet: being generated, waiting for approval, failed or simply missing. It names
 * no make or model and promises no time. It renders at once, from a bundled
 * asset, so it is never a loading spinner. The status is its accessibility
 * label; the card shows it as text in its copy column, never over the car.
 */
export default function VehicleImagePlaceholder({
  testID,
  width,
  height,
  status,
  stage,
}: {
  testID?: string;
  width: number;
  height: number;
  status?: VehicleImageStatus | null;
  stage?: VehicleImageStage;
}) {
  const { t } = useTranslation();
  const { scheme } = useThemeContext();
  const message = t(placeholderMessageKey(status, stage));

  return (
    <AppView
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={message}
      style={{ width, height }}
    >
      {/* Light ghost art: a little quieter on the dark card, where it would glow. */}
      <Image
        source={universalPlaceholderArt}
        contentFit="contain"
        style={{ width, height, opacity: scheme === 'dark' ? 0.7 : 1 }}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    </AppView>
  );
}
