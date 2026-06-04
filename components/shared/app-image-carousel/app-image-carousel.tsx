import { Image, type ImageSource } from 'expo-image';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    I18nManager,
    type ListRenderItemInfo,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type StyleProp,
    StyleSheet,
    type ViewStyle,
    ViewToken,
} from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type IndicatorVariant = 'dots' | 'count' | 'none';

export type AppImageCarouselProps = {
  sources: ImageSource[];
  height?: number; // fixed height
  aspectRatio?: number; // width / height; if set, container uses aspectRatio and grows with width
  rounded?: number; // border radius for container and images
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down';
  showIndicators?: IndicatorVariant;
  /** Dots indicator style. Default keeps existing centered dots. */
  dotsVariant?: 'plain' | 'pill';
  /** Only applies when showIndicators='dots'. */
  dotsAlign?: 'left' | 'center' | 'right';
  /** Additional style for the dots container (absolute-positioned wrapper). */
  dotsContainerStyle?: StyleProp<ViewStyle>;
  /** Additional style for each dot. */
  dotStyle?: StyleProp<ViewStyle>;
  /** Additional style for active dot (merged after dotStyle). */
  activeDotStyle?: StyleProp<ViewStyle>;
  /** Blur props for pill variant. */
  dotsBlurIntensity?: number;
  dotsBlurTint?: 'light' | 'dark' | 'default';
  onIndexChange?: (index: number) => void;
  initialIndex?: number;
  previewIndexLabel?: (index: number, total: number) => string; // for 'count' indicator
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ViewStyle>;
  enablePress?: boolean;
  onPressImage?: (index: number) => void;
  transitionMs?: number;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AppImageCarouselComponent: React.FC<AppImageCarouselProps> = ({
  sources,
  height = 220,
  aspectRatio,
  rounded = 12,
  contentFit = 'cover',
  showIndicators = 'dots',
  dotsVariant = 'plain',
  dotsAlign = 'center',
  dotsContainerStyle,
  dotStyle,
  activeDotStyle,
  dotsBlurIntensity = 30,
  dotsBlurTint = 'dark',
  onIndexChange,
  initialIndex = 0,
  previewIndexLabel,
  containerStyle,
  imageStyle,
  enablePress,
  onPressImage,
  transitionMs = 200,
}) => {
  const { tokens: C } = useThemeContext();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(sources.length - 1, 0)),
  );
  const listRef = useRef<FlatList<ImageSource>>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const itemWidth = containerWidth || SCREEN_WIDTH; // fallback until measured

  // RTL support: invert scroll direction
  const inverted = I18nManager.isRTL;

  // Map between FlatList's internal index (which respects inverted ordering) and the visual LTR index we expose
  const toVisualIndex = useCallback(
    (flatIndex: number) => {
      if (!inverted) return flatIndex;
      return Math.max(0, sources.length - 1 - flatIndex);
    },
    [inverted, sources.length],
  );

  const toFlatIndex = useCallback(
    (visualIdx: number) => {
      if (!inverted) return visualIdx;
      return Math.max(0, sources.length - 1 - visualIdx);
    },
    [inverted, sources.length],
  );

  // Update index on scroll end to avoid re-rendering every frame
  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const newFlatIndex = Math.round(x / itemWidth);
      const newVisualIndex = toVisualIndex(newFlatIndex);
      if (newVisualIndex !== index) {
        setIndex(newVisualIndex);
        onIndexChange?.(newVisualIndex);
      }
    },
    [index, itemWidth, onIndexChange, toVisualIndex],
  );

  const viewabilityConfig = useMemo(() => ({ viewAreaCoveragePercentThreshold: 60 }), []);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      const v = viewableItems?.[0];
      if (v && typeof v.index === 'number') {
        const newVisualIndex = toVisualIndex(v.index);
        setIndex((prev) => (prev !== newVisualIndex ? newVisualIndex : prev));
        if (onIndexChange) onIndexChange(newVisualIndex);
      }
    },
  );

  // Keep the same visual index when width changes (e.g., rotation or initial layout measure)
  useEffect(() => {
    if (!listRef.current) return;
    try {
      listRef.current.scrollToIndex({ index: toFlatIndex(index), animated: false });
    } catch {
      /* no-op */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemWidth]);

  // Clamp index when data changes (e.g., sources updated dynamically)
  useEffect(() => {
    if (index > sources.length - 1) {
      const next = Math.max(0, sources.length - 1);
      setIndex(next);
      // also align FlatList silently
      if (listRef.current) {
        try {
          listRef.current.scrollToIndex({ index: toFlatIndex(next), animated: false });
        } catch {
          /* no-op */
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length]);

  const renderItem = useCallback(
    ({ item, index: idx }: ListRenderItemInfo<ImageSource>) => {
      const recyclingKey =
        typeof item === 'object' && item && 'uri' in item && item.uri
          ? String(item.uri)
          : String(idx);
      const Img = (
        <Image
          source={item}
          style={[{ width: itemWidth, height, borderRadius: rounded }, imageStyle] as any}
          contentFit={contentFit}
          transition={transitionMs}
          cachePolicy={'memory-disk'}
          recyclingKey={recyclingKey}
          priority={idx === toFlatIndex(index) ? 'high' : 'normal'}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Image ${toVisualIndex(idx) + 1} of ${sources.length}`}
          onError={undefined}
          // If you want placeholders in the future, use blurhash or a static placeholder color
          // placeholder={placeholder}
        />
      );
      if (!enablePress) return Img;
      return (
        <AppPressableView
          onPress={() => onPressImage?.(idx)}
          style={{ width: itemWidth, height, borderRadius: rounded, overflow: 'hidden' }}
        >
          {Img}
        </AppPressableView>
      );
    },
    [
      contentFit,
      enablePress,
      height,
      imageStyle,
      itemWidth,
      onPressImage,
      rounded,
      sources.length,
      toFlatIndex,
      toVisualIndex,
      transitionMs,
      index,
    ],
  );

  const indicator = (() => {
    if (showIndicators === 'none' || sources.length <= 1) return null;
    if (showIndicators === 'count') {
      const label = previewIndexLabel
        ? previewIndexLabel(index + 1, sources.length)
        : `${index + 1}/${sources.length}`;
      return (
        <AppView
          px={8}
          py={4}
          rounded={12}
          style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: C.overlay }}
        >
          <AppText textVariant="bodyXs" weight="semibold" style={{ color: C.white }}>
            {label}
          </AppText>
        </AppView>
      );
    }
    // dots
    const isPill = dotsVariant === 'pill';
    const dotBase = {
      width: 6,
      height: 6,
      borderRadius: 4,
      backgroundColor: isPill ? 'rgba(255,255,255,0.45)' : C.gray400,
      opacity: 0.95,
    } as ViewStyle;
    const dotActive = {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: isPill ? 'rgba(255,255,255,0.95)' : C.primaryBg,
      opacity: 0.95,
    } as ViewStyle;

    const plainStyle: ViewStyle = {
      position: 'absolute',
      bottom: 10,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    };

    const pillPos: ViewStyle = (() => {
      const base: ViewStyle = { position: 'absolute', bottom: 12 };
      if (dotsAlign === 'left') return { ...base, left: 14 };
      if (dotsAlign === 'right') return { ...base, right: 14 };
      return { ...base, left: 0, right: 0, alignItems: 'center' };
    })();

    const dotsRow = (
      <AppView
        row
        gap={8}
        style={dotsVariant === 'pill' ? { paddingHorizontal: 12, paddingVertical: 8 } : undefined}
      >
        {sources.map((_, i) => (
          <AppView
            key={i}
            style={[
              dotBase,
              dotStyle,
              i === index ? dotActive : null,
              i === index ? activeDotStyle : null,
            ]}
          />
        ))}
      </AppView>
    );

    if (dotsVariant === 'pill') {
      return (
        <AppView pointerEvents="none" style={[pillPos, dotsContainerStyle] as any}>
          <AppView
            style={[
              styles.dotsPill,
              {
                backgroundColor:
                  dotsBlurTint === 'light'
                    ? 'rgba(255,255,255,0.22)'
                    : dotsBlurTint === 'dark'
                      ? 'rgba(0,0,0,0.28)'
                      : `rgba(0,0,0,${Math.min(Math.max(dotsBlurIntensity / 100, 0.12), 0.36)})`,
              },
            ]}
          >
            {dotsRow}
          </AppView>
        </AppView>
      );
    }

    return (
      <AppView row gap={6} style={[plainStyle, dotsContainerStyle] as any}>
        {sources.map((_, i) => (
          <AppView
            key={i}
            style={[
              dotBase,
              dotStyle,
              i === index ? dotActive : null,
              i === index ? activeDotStyle : null,
            ]}
          />
        ))}
      </AppView>
    );
  })();

  const containerDimsStyle: StyleProp<ViewStyle> = aspectRatio
    ? { aspectRatio, width: '100%' }
    : { height };

  return (
    <AppView
      style={
        [{ borderRadius: rounded, overflow: 'hidden' }, containerDimsStyle, containerStyle] as any
      }
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && Math.abs(w - containerWidth) > 0.5) setContainerWidth(w);
      }}
    >
      <FlatList
        ref={listRef}
        data={sources}
        keyExtractor={(src, i) => {
          const key =
            typeof src === 'object' && src && 'uri' in src && src.uri ? String(src.uri) : String(i);
          return key;
        }}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        snapToInterval={itemWidth}
        snapToAlignment={'start'}
        decelerationRate={'fast'}
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        initialScrollIndex={toFlatIndex(initialIndex)}
        getItemLayout={(_, i) => ({ length: itemWidth, offset: itemWidth * i, index: i })}
        initialNumToRender={2}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig}
        inverted={inverted}
        scrollEnabled={sources.length > 1}
      />
      {indicator}
    </AppView>
  );
};

export const AppImageCarousel = memo(AppImageCarouselComponent);
AppImageCarousel.displayName = 'AppImageCarousel';

export default AppImageCarousel;

const styles = StyleSheet.create({
  dotsPill: {
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
});
