import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Platform,
  ScrollView,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
 * Full-screen photo viewer: a paged, zoomable gallery over a black field.
 *
 * Built on core `Modal` + `ScrollView` rather than `react-native-image-viewing`,
 * which this wrapper used to delegate to. That package was last published in
 * 2021, declares a `react-native >= 0.61` peer range, and drives its pager with
 * `VirtualizedList` inside a `Modal` — on RN 0.85 it is the single most likely
 * reason the viewer never appeared, and nothing else in the app depends on it,
 * so there was no way to tell it apart from a working viewer with no photos to
 * show. Core components remove the question.
 *
 * Zoom is `ScrollView`'s native pinch, which is **iOS-only** — on Android the
 * photo fills the screen and pages, but does not pinch. That is the one
 * capability lost in the swap; catalog photos are shot on white at modest
 * resolution, so full-bleed viewing is the part that mattered.
 */
function AppImageViewerBase({
  visible,
  images,
  initialIndex = 0,
  onClose,
  renderCaption,
}: AppImageViewerProps) {
  const { tokens } = useThemeContext();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [index, setIndex] = useState(initialIndex);
  const pager = useRef<ScrollView>(null);

  // Re-enter on the photo the caller opened — the viewer is mounted for the
  // life of the screen, so without this it would always reopen on the last one.
  useEffect(() => {
    if (!visible) return;
    setIndex(initialIndex);
    // `contentOffset` is iOS-only; scroll after layout so Android lands too.
    const id = setTimeout(
      () => pager.current?.scrollTo({ x: initialIndex * width, y: 0, animated: false }),
      0,
    );
    return () => clearTimeout(id);
  }, [visible, initialIndex, width]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.max(
        0,
        Math.min(images.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)),
      );
      setIndex(next);
    },
    [images.length, width],
  );

  const caption = renderCaption?.(index) ?? null;

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      supportedOrientations={['portrait']}
    >
      <AppView flex={1} style={{ backgroundColor: tokens.black }}>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEnabled={images.length > 1}
          contentOffset={Platform.OS === 'ios' ? { x: initialIndex * width, y: 0 } : undefined}
        >
          {images.map((image, i) => (
            <ScrollView
              key={typeof image === 'number' ? `asset-${i}` : image.uri}
              style={{ width, height }}
              contentContainerStyle={{
                width,
                height,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              maximumZoomScale={3}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={image}
                style={{ width, height }}
                contentFit="contain"
                transition={120}
                cachePolicy="memory-disk"
                accessibilityLabel={t('fields.imageViewer', { index: i + 1 })}
              />
            </ScrollView>
          ))}
        </ScrollView>

        {/* Close — chrome, like a back button, so it keeps its glyph. */}
        <AppView
          row
          justify="flex-end"
          px={16}
          style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0 }}
        >
          <AppPressableView
            center
            rounded={999}
            fillContainer
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('fields.closeImageViewer')}
            androidRipple={false}
            pressedOpacity={0.7}
            style={{ width: 40, height: 40, backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
          >
            <X size={20} strokeWidth={2.4} color={tokens.white} />
          </AppPressableView>
        </AppView>

        {caption ? (
          <AppView
            px={20}
            pt={12}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingBottom: Math.max(insets.bottom, 20),
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
          >
            <AppText
              family="accent"
              weight="semibold"
              style={{ color: tokens.white, fontSize: 13, textAlign: 'center' }}
            >
              {caption}
            </AppText>
          </AppView>
        ) : null}
      </AppView>
    </Modal>
  );
}

export default memo(AppImageViewerBase);
