import {
  Image as ExpoImage,
  type ImageContentFit,
  type ImageContentPosition,
  type ImageSource,
  type ImageTransition,
} from 'expo-image';
import { forwardRef, memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityRole,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useThemeContext } from '@/contexts/theme.context';
import type { ColorName } from '@/themes';

export type AppImageSource = ImageSource | number | string | null | undefined;

export type AppImageProps = {
  /** Remote URL string, local require(), or an expo-image ImageSource. Null/undefined renders the placeholder. */
  source?: AppImageSource;

  // ── Sizing ─────────────────────────────────────────────────────────
  width?: DimensionValue;
  height?: DimensionValue;
  /** Locks the box's aspect ratio (w/h). Useful with one of width/height. */
  aspectRatio?: number;

  // ── Chrome (theme-aware) ───────────────────────────────────────────
  rounded?: number;
  borderName?: ColorName;
  borderWidth?: number;
  /** Background color shown while the image loads. Defaults to the theme's 'backgroundSecondary'. */
  placeholderColorName?: ColorName;
  /** Override placeholderColorName with a raw color. */
  placeholderColor?: string;

  // ── Image behavior ─────────────────────────────────────────────────
  /** Default 'cover'. */
  contentFit?: ImageContentFit;
  contentPosition?: ImageContentPosition;
  /**
   * Hint to expo-image for prefetch priority. Use 'high' for above-the-fold
   * hero shots, 'low' for offscreen list items.
   */
  priority?: 'low' | 'normal' | 'high';
  /** Default 'memory-disk' so revisits skip the network. */
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  /** Transition (ms) when the image swaps in. Default 180. Pass 0 to disable. */
  transition?: number | ImageTransition;
  /**
   * Recycling key for FlatList/VirtualizedList reuse. When the underlying view
   * is recycled with a new image, supplying a stable key prevents a stale
   * frame flash. Defaults to the source URI when available.
   */
  recyclingKey?: string;
  /** Allow expo-image to decide downscale based on parent layout. Default true. */
  allowDownscaling?: boolean;

  // ── States & accessibility ─────────────────────────────────────────
  /** Rendered in place of the image when the source fails to load. */
  fallback?: React.ReactNode;
  /** Accessibility label / alt text. */
  alt?: string;
  /** Override accessibility role. Default 'image'. */
  accessibilityRole?: AccessibilityRole;

  // ── Container style override (merged last) ─────────────────────────
  style?: StyleProp<ViewStyle>;

  // ── Callbacks ──────────────────────────────────────────────────────
  onLoad?: () => void;
  onError?: () => void;
};

function coerceSource(input: AppImageSource): ImageSource | number | undefined {
  if (input == null) return undefined;
  if (typeof input === 'number') return input;
  if (typeof input === 'string') return { uri: input };
  return input;
}

function getSourceUri(input: AppImageSource): string | undefined {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object' && 'uri' in input && typeof input.uri === 'string') {
    return input.uri;
  }
  return undefined;
}

const AppImageImpl = forwardRef<View, AppImageProps>(function AppImage(
  {
    source,
    width,
    height,
    aspectRatio,
    rounded,
    borderName,
    borderWidth,
    placeholderColorName = 'backgroundSecondary',
    placeholderColor,
    contentFit = 'cover',
    contentPosition,
    priority = 'normal',
    cachePolicy = 'memory-disk',
    transition = 180,
    recyclingKey,
    allowDownscaling = true,
    fallback,
    alt,
    accessibilityRole = 'image',
    style,
    onLoad,
    onError,
  },
  ref,
) {
  const { tokens } = useThemeContext();
  const [hasError, setHasError] = useState(false);

  const normalized = useMemo(() => coerceSource(source), [source]);
  const sourceUri = useMemo(() => getSourceUri(source), [source]);

  // Reset error state when the source changes (e.g. user picks a new vehicle).
  useEffect(() => {
    setHasError(false);
  }, [sourceUri, normalized]);

  const resolvedPlaceholder =
    placeholderColor ?? tokens[placeholderColorName] ?? tokens.backgroundSecondary;
  const resolvedBorderColor = borderName ? tokens[borderName] : undefined;

  const containerStyle = useMemo<ViewStyle>(
    () => ({
      width,
      height,
      aspectRatio,
      backgroundColor: resolvedPlaceholder,
      overflow: 'hidden',
      ...(rounded != null ? { borderRadius: rounded } : null),
      ...(borderWidth != null ? { borderWidth } : null),
      ...(resolvedBorderColor != null ? { borderColor: resolvedBorderColor } : null),
    }),
    [
      width,
      height,
      aspectRatio,
      resolvedPlaceholder,
      rounded,
      borderWidth,
      resolvedBorderColor,
    ],
  );

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  const showFallback = (hasError || normalized == null) && fallback != null;

  return (
    <View
      ref={ref}
      style={[containerStyle, style]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={alt}
      accessible={!!alt}
    >
      {showFallback ? (
        <View style={StyleSheet.absoluteFill}>{fallback}</View>
      ) : normalized != null ? (
        <ExpoImage
          source={normalized}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          contentPosition={contentPosition}
          priority={priority}
          cachePolicy={cachePolicy}
          transition={transition}
          recyclingKey={recyclingKey ?? sourceUri}
          allowDownscaling={allowDownscaling}
          accessible={false}
          onLoad={onLoad}
          onError={handleError}
        />
      ) : null}
    </View>
  );
});

AppImageImpl.displayName = 'AppImage';

export const AppImage = memo(AppImageImpl);

export default AppImage;
