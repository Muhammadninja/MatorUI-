import { X } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { StatusBar } from 'react-native';
import ImageView from 'react-native-image-viewing';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type AppImageViewerImage = { uri: string } | number;

export type AppImageViewerProps = {
  visible: boolean;
  images: AppImageViewerImage[];
  initialIndex?: number;
  onClose: () => void;
  /** Optional caption rendered at the bottom (e.g. "1 of 5 · Photo by …"). */
  renderCaption?: (currentIndex: number) => string | null;
};

/**
 * Themed wrapper around react-native-image-viewing. Adds:
 *  - Themed close button (top-right) with safe-area aware positioning.
 *  - Optional caption strip at the bottom (page count, alt text, etc.).
 *  - Memoized so consumers can pass it inside lists without re-renders.
 */
function AppImageViewerBase({
  visible,
  images,
  initialIndex = 0,
  onClose,
  renderCaption,
}: AppImageViewerProps) {
  const { tokens } = useThemeContext();

  const HeaderComponent = useCallback(
    () => (
      <AppView
        row
        align="center"
        justify="flex-end"
        px={16}
        pt={48}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
      >
        <AppPressableView
          center
          rounded={36}
          onPress={onClose}
          accessibilityLabel="Close image viewer"
          androidRipple
          style={{
            width: 40,
            height: 40,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <X size={20} strokeWidth={2.4} color="#fff" />
        </AppPressableView>
      </AppView>
    ),
    [onClose],
  );

  const FooterComponent = useCallback(
    ({ imageIndex }: { imageIndex: number }) => {
      const caption = renderCaption?.(imageIndex);
      if (!caption) return null;
      return (
        <AppView
          px={20}
          pb={32}
          pt={12}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <AppText style={{ color: '#fff', fontSize: 13, textAlign: 'center' }}>
            {caption}
          </AppText>
        </AppView>
      );
    },
    [renderCaption],
  );

  return (
    <ImageView
      images={images as never}
      imageIndex={initialIndex}
      visible={visible}
      onRequestClose={onClose}
      swipeToCloseEnabled
      doubleTapToZoomEnabled
      backgroundColor={tokens.black ?? '#000'}
      HeaderComponent={HeaderComponent}
      FooterComponent={FooterComponent as never}
      presentationStyle="overFullScreen"
      animationType="fade"
      onLongPress={() => StatusBar.setHidden(true)}
    />
  );
}

export default memo(AppImageViewerBase);
