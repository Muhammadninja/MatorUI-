import { forwardRef, memo, ReactNode, useCallback, useMemo, useRef } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type AppScrollViewProps = ScrollViewProps & {
  children: ReactNode;
  /**
   * Apply safe area insets as padding to the content container.
   * boolean applies all edges; object allows selecting edges individually.
   */
  safe?: boolean | { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
  /**
   * Ensure content container grows to fill available height (useful for centering or footer-stick-to-bottom layouts).
   */
  fill?: boolean;
  /**
   * Convenience padding for content container. Number => vertical padding. Object for vertical/horizontal.
   * Defaults to { vertical: 16 }. Adds a small extra bottom padding on Android to prevent bottom tab bars from covering the last content.
   */
  padding?: number | { vertical?: number; horizontal?: number };
  /**
   * Style applied to the content container (merged last)
   */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Style applied to the ScrollView (merged last)
   */
  style?: StyleProp<ViewStyle>;

  /** Optional header rendered above children inside content container */
  header?: ReactNode;
  /** Optional footer rendered below children inside content container */
  footer?: ReactNode;

  /** Fire when user reaches near the end; threshold in px from bottom (default 48) */
  onReachEnd?: () => void;
  reachEndThreshold?: number;

  /** Lightweight refresh control (only used if refreshControl not provided) */
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshColors?: string[]; // Android
  refreshTintColor?: string; // iOS
  refreshTitle?: string; // iOS
  refreshProgressViewOffset?: number; // Android
};

export const AppScrollView = memo(
  forwardRef<ScrollView, AppScrollViewProps>(
    (
      {
        children,
        safe = false,
        fill = false,
        padding = { vertical: 16 },
        style,
        contentContainerStyle,
        keyboardShouldPersistTaps = 'handled',
        keyboardDismissMode = Platform.select({ ios: 'on-drag', default: 'none' }),
        showsVerticalScrollIndicator = false,
        header,
        footer,
        onReachEnd,
        reachEndThreshold = 48,
        refreshing,
        onRefresh,
        refreshColors,
        refreshTintColor,
        refreshTitle,
        refreshProgressViewOffset,
        ...rest
      },
      ref,
    ) => {
      const insets = useSafeAreaInsets();
      const scrollRef = useRef<ScrollView | null>(null);
      // Link forwarded ref and internal ref
      const setRefs = useCallback(
        (node: ScrollView | null) => {
          scrollRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref && 'current' in ref) (ref as any).current = node;
        },
        [ref],
      );

      const basePadding = useMemo(() => {
        // Android: the bottom tab bar is absolutely positioned; add extra bottom padding
        // so the last content isn't covered (feels like "can't scroll to end").
        const extraBottom = Platform.OS === 'android' && !rest.horizontal ? 90 : 0;
        if (typeof padding === 'number') {
          return { paddingTop: padding, paddingBottom: padding + extraBottom } as ViewStyle;
        }
        const v = padding?.vertical ?? 16;
        const h = padding?.horizontal ?? 0;
        return { paddingTop: v, paddingBottom: v + extraBottom, paddingHorizontal: h } as ViewStyle;
      }, [padding, rest.horizontal]);

      const safePadding = useMemo(() => {
        if (!safe) return null;
        const edges =
          typeof safe === 'boolean' ? { top: true, bottom: true, left: true, right: true } : safe;
        return {
          paddingTop: edges.top ? insets.top : undefined,
          paddingBottom: edges.bottom ? insets.bottom : undefined,
          paddingLeft: edges.left ? insets.left : undefined,
          paddingRight: edges.right ? insets.right : undefined,
        } as ViewStyle;
      }, [safe, insets.bottom, insets.left, insets.right, insets.top]);

      const containerStyle = useMemo(() => {
        return [
          styles.container,
          basePadding,
          fill && styles.fill,
          safePadding,
          contentContainerStyle,
        ];
      }, [basePadding, contentContainerStyle, fill, safePadding]);

      // Build RefreshControl if not explicitly provided
      const builtRefreshControl = useMemo(() => {
        if (rest.refreshControl) return rest.refreshControl;
        if (typeof refreshing === 'boolean' || onRefresh) {
          return (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              colors={refreshColors}
              tintColor={refreshTintColor}
              title={refreshTitle}
              progressViewOffset={refreshProgressViewOffset}
            />
          );
        }
        return undefined;
      }, [
        refreshColors,
        refreshProgressViewOffset,
        refreshTintColor,
        refreshTitle,
        refreshing,
        onRefresh,
        rest.refreshControl,
      ]);

      // Call onReachEnd when near bottom
      const hasReachedEndRef = useRef(false);
      const handleScroll = useCallback<NonNullable<ScrollViewProps['onScroll']>>(
        (e) => {
          if (rest.onScroll) rest.onScroll(e);
          if (!onReachEnd) return;
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
          const distanceFromBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height);
          const nearEnd = distanceFromBottom <= reachEndThreshold;
          if (nearEnd && !hasReachedEndRef.current) {
            hasReachedEndRef.current = true;
            onReachEnd();
          } else if (!nearEnd && hasReachedEndRef.current) {
            // reset when user scrolls away from the end
            hasReachedEndRef.current = false;
          }
        },
        [onReachEnd, reachEndThreshold, rest],
      );

      return (
        <ScrollView
          ref={setRefs}
          style={[styles.scrollView, style]}
          contentContainerStyle={containerStyle}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode={keyboardDismissMode}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          bounces={rest.bounces ?? (Platform.OS === 'ios' ? true : undefined)}
          contentInsetAdjustmentBehavior={
            rest.contentInsetAdjustmentBehavior ?? (Platform.OS === 'ios' ? 'automatic' : undefined)
          }
          // Don't enable nested scrolling by default; it can interfere with vertical scroll in some Android setups.
          nestedScrollEnabled={rest.nestedScrollEnabled}
          // Only apply keyboard inset auto-adjust on iOS.
          automaticallyAdjustKeyboardInsets={
            rest.automaticallyAdjustKeyboardInsets ?? (Platform.OS === 'ios' ? true : undefined)
          }
          refreshControl={builtRefreshControl}
          onScroll={handleScroll}
          scrollEventThrottle={rest.scrollEventThrottle ?? 16}
          {...rest}
        >
          {header}
          {children}
          {footer}
        </ScrollView>
      );
    },
  ),
);

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    // Keep layout stable and let content define height; opt-in fill via prop
  },
  fill: {
    flexGrow: 1,
  },
});

AppScrollView.displayName = 'AppScrollView';

export default AppScrollView;
