import { Image } from 'expo-image';
import { ImagePlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { placeholderMessageKey, type VehicleImageStatus } from '@/services/vehicle-images/image-status';

import universalPlaceholderArt from '@/assets/vehicles/placeholder/universal.webp';

/** Where the ghost car's tyres end in the art's 2:1 frame (the car is centred). */
const ART_GROUND = 0.911;
/** Clear space between the tyres and the status note. */
const NOTE_GAP = 4;

/**
 * A ghosted, deliberately generic car with a small note under it, for a vehicle
 * with no approved picture yet: being generated, waiting for approval, failed or
 * simply missing. It names no make or model and promises no time. It renders at
 * once, from a bundled asset, so it is never a loading spinner.
 *
 * The note hangs below the frame, so the space under the car must be free.
 */
export default function VehicleImagePlaceholder({
  testID,
  width,
  height,
  status,
}: {
  testID?: string;
  width: number;
  height: number;
  status?: VehicleImageStatus | null;
}) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const message = t(placeholderMessageKey(status));

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
      {/* Centred under the car, never across it. */}
      <AppView
        style={{
          position: 'absolute',
          top: height * ART_GROUND + NOTE_GAP,
          left: 0,
          width,
          alignItems: 'center',
        }}
      >
        <AppView
          testID={testID ? `${testID}-label` : undefined}
          row
          align="center"
          gap={4}
          style={{
            maxWidth: width,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.card,
          }}
        >
          <ImagePlus size={11} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="default" weight="medium" style={{ fontSize: 11.5, lineHeight: 15, color: tokens.textMuted, flexShrink: 1 }}>
            {message}
          </AppText>
        </AppView>
      </AppView>
    </AppView>
  );
}
