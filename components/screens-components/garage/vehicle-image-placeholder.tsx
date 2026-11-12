import { Image } from 'expo-image';
import { ImagePlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { placeholderMessageKey, type VehicleImageStatus } from '@/services/vehicle-images/image-status';

import universalPlaceholderArt from '@/assets/vehicles/placeholder/universal.webp';

/**
 * Where the artwork's own label sits in its 2:1 frame (measured on the 1774×887
 * source). The label is drawn again here in the app's language, over the baked-in
 * Russian one, and never smaller than it, so the baked text never shows through.
 */
const ART_LABEL = { left: 0.279, top: 0.44, right: 0.728, bottom: 0.591 };

/**
 * A ghosted, deliberately generic car with a short note, for a vehicle with no
 * approved picture yet: being generated, waiting for approval, failed or simply
 * missing. It names no make or model and promises no time. It renders at once,
 * from a bundled asset, so it is never a loading spinner.
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
  const labelWidth = width * (ART_LABEL.right - ART_LABEL.left);
  const labelHeight = height * (ART_LABEL.bottom - ART_LABEL.top);

  return (
    <AppView
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={message}
      style={{ width, height }}
    >
      {/* Light ghost art: quieter on the dark card, where it would otherwise glow. */}
      <Image
        source={universalPlaceholderArt}
        contentFit="contain"
        style={{ width, height, opacity: scheme === 'dark' ? 0.45 : 1 }}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
      {/* The baked label is centred, so a longer translation grows from the middle. */}
      <AppView
        style={{ position: 'absolute', top: height * ART_LABEL.top - 2, left: 0, right: 0, alignItems: 'center' }}
      >
        <AppView
          testID={testID ? `${testID}-label` : undefined}
          row
          align="center"
          justify="center"
          gap={6}
          style={{
            minWidth: labelWidth + 4,
            maxWidth: width,
            minHeight: labelHeight + 4,
            paddingHorizontal: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.card,
          }}
        >
          <ImagePlus size={Math.max(12, Math.round(labelHeight * 0.5))} strokeWidth={2} color={tokens.textMuted} />
          <AppText
            family="default"
            weight="medium"
            style={{ fontSize: Math.max(10, Math.min(13, labelHeight * 0.42)), color: tokens.textMuted, flexShrink: 1 }}
          >
            {message}
          </AppText>
        </AppView>
      </AppView>
    </AppView>
  );
}
