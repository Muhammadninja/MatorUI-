import React, { forwardRef, memo, useMemo, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  type AccessibilityRole,
  type Insets,
  type LayoutChangeEvent,
  type PressableAndroidRippleConfig,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeContext } from '@/contexts/theme.context';
import { getShadowStyle, type ColorName } from '@/themes';
import type { AppViewProps } from './app-view';
import { useColorToken, useResolvedBackgroundColor } from './colors';
import { composeSafeAreaPadding } from './safe-area';
import { composeBorder, composeFlexbox, composeRounding, composeSpacing } from './style-compose';
import { APP_PRESSABLE_DEFAULTS, DEFAULT_RIPPLE_COLOR_NAME, SHADOW_DEFAULT_LEVEL } from './tokens';

/**
 * Dev-only guard for a failure this component makes easy and silent.
 *
 * Width is deliberately NOT forced (see `innerLayout` below) — forcing it
 * would stretch chips inside horizontal ScrollViews. The cost is that in some
 * parents a ROW pressable shrinks to its content width, the `flex: 1` column
 * collapses to ~0, and the row renders at the right HEIGHT with no visible
 * text. It reads as a data or theming bug, and it has been hit repeatedly in
 * this codebase (cart rows, notification rows, settings rows, the catalog
 * fitment bar), each time right after a fixed-width child such as an icon tile
 * was removed.
 *
 * This MEASURES rather than guesses: a static "row + flex child" check fires
 * on plenty of healthy rows (a column parent stretches them anyway), and a
 * warning that cries wolf gets ignored. Only a row that actually laid out
 * narrower than `COLLAPSE_WIDTH_PX` while carrying a flexible child is
 * reported — that is the broken state, not a guess at it.
 */
const COLLAPSE_WIDTH_PX = 64;

function hasFlexChild(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some((child) => {
    if (!React.isValidElement(child)) return false;
    const props = child.props as { flex?: number; style?: unknown };
    if (props.flex === 1) return true;
    const flat = StyleSheet.flatten(props.style as never) as { flex?: number } | undefined;
    return flat?.flex === 1;
  });
}

function useCollapseWarning(
  isRow: boolean,
  fillContainer: boolean,
  children: React.ReactNode,
  testID?: string,
): ((event: LayoutChangeEvent) => void) | undefined {
  const warned = useRef(false);
  const enabled = typeof __DEV__ !== 'undefined' && __DEV__ && isRow && !fillContainer;

  return useMemo(() => {
    if (!enabled) return undefined;
    return (event: LayoutChangeEvent) => {
      if (warned.current) return;
      const { width } = event.nativeEvent.layout;
      if (width >= COLLAPSE_WIDTH_PX || !hasFlexChild(children)) return;
      warned.current = true;
      console.warn(
        `[AppPressableView] A \`row\` pressable${testID ? ` (testID "${testID}")` : ''} laid out ` +
          `${Math.round(width)}px wide with a flex child — it has shrunk to its content and the ` +
          'flex column has collapsed, so the row is rendering blank. Add `fillContainer`.',
      );
    };
  }, [enabled, children, testID]);
}

export type AppPressableViewProps = AppViewProps & {
  onPress?: PressableProps['onPress'];
  onLongPress?: PressableProps['onLongPress'];
  onPressIn?: PressableProps['onPressIn'];
  onPressOut?: PressableProps['onPressOut'];
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  testID?: string;
  hitSlop?: Insets;
  /** Android ripple config or boolean to enable with themed default */
  androidRipple?: boolean | PressableAndroidRippleConfig;
  /** Optional explicit ripple color; if omitted and androidRipple=true, uses theme token */
  rippleColor?: string;
  /** Theme color token to derive ripple color from (defaults to 'overlay') */
  rippleColorName?: ColorName;
  /** Press visuals */
  pressedOpacity?: number; // default 0.85
  pressedScale?: number; // default 0.98
  /** Background color to show when pressed (overrides opacity) */
  pressedBackgroundColor?: string;
  /** Make Pressable fill parent container (needed for segmented controls, pills, etc) */
  fillContainer?: boolean;
};

const AppPressableViewBase = forwardRef<React.ElementRef<typeof Pressable>, AppPressableViewProps>(
  function AppPressableView(
    {
      style,
      lightColor,
      darkColor,
      colorName,
      // spacing
      p,
      px,
      py,
      pt,
      pb,
      pl,
      pr,
      m,
      mx,
      my,
      mt,
      mb,
      ml,
      mr,
      gap,
      rowGap,
      columnGap,
      // rounding/border
      rounded,
      borderRadius,
      roundedTop,
      roundedBottom,
      roundedLeft,
      roundedRight,
      borderWidth,
      borderTopWidth,
      borderBottomWidth,
      borderLeftWidth,
      borderRightWidth,
      borderColor,
      borderName,
      // shadow
      shadow,
      shadowLevel,
      // flex
      row,
      center,
      align,
      justify,
      wrap,
      flex,
      grow,
      shrink,
      // safe area
      safeTop,
      safeArea,
      // pressable extras
      onPress,
      onLongPress,
      onPressIn,
      onPressOut,
      disabled,
      accessibilityRole,
      accessibilityLabel,
      testID,
      hitSlop,
      androidRipple,
      rippleColor,
      rippleColorName = DEFAULT_RIPPLE_COLOR_NAME,
      pressedOpacity = APP_PRESSABLE_DEFAULTS.pressedOpacity,
      pressedScale = APP_PRESSABLE_DEFAULTS.pressedScale,
      pressedBackgroundColor,
      fillContainer = false,
      children,
      ...other
    },
    ref,
  ) {
    const { tokens } = useThemeContext();
    const insets = useSafeAreaInsets();
    const onCollapseLayout = useCollapseWarning(row === true, fillContainer, children, testID);
    const backgroundColor = useResolvedBackgroundColor({ lightColor, darkColor, colorName });
    const borderResolvedColor = useColorToken(borderName);

    // Animated value for pressed background fade
    const pressedAnim = useRef(new Animated.Value(0)).current;

    // Flexbox + gap need to apply to the inner Pressable so its CHILDREN
    // arrange correctly (row/center/gap) — applying these to the outer
    // Animated.View doesn't reach the Pressable's children. Padding +
    // border + bg stay on the outer so visual chrome is unchanged.
    // Width/height are NOT forced here — that would make the Pressable
    // stretch in flex-row parents with default `alignItems: 'stretch'`
    // (e.g. chips in a horizontal ScrollView blow up to screen height).
    // Use `fillContainer` to opt in to filling explicitly.
    const innerLayout = useMemo<ViewStyle>(() => {
      const flexbox = composeFlexbox({ row, center, align, justify, wrap, flex, grow, shrink });
      const out: ViewStyle = { ...flexbox };
      if (gap !== undefined) out.gap = gap;
      if (rowGap !== undefined) out.rowGap = rowGap;
      if (columnGap !== undefined) out.columnGap = columnGap;
      return out;
    }, [row, center, align, justify, wrap, flex, grow, shrink, gap, rowGap, columnGap]);

    const base = useMemo<ViewStyle>(() => {
      const spacing = composeSpacing({
        p,
        px,
        py,
        pt,
        pb,
        pl,
        pr,
        m,
        mx,
        my,
        mt,
        mb,
        ml,
        mr,
        gap,
        rowGap,
        columnGap,
      });
      const flexbox = composeFlexbox({ row, center, align, justify, wrap, flex, grow, shrink });
      const rounding = composeRounding({
        rounded,
        borderRadius,
        roundedTop,
        roundedBottom,
        roundedLeft,
        roundedRight,
      });
      const border = composeBorder({
        borderWidth,
        borderTopWidth,
        borderBottomWidth,
        borderLeftWidth,
        borderRightWidth,
        borderColor: borderColor ?? borderResolvedColor,
      });
      const shadowStyle: ViewStyle =
        shadow || shadowLevel
          ? getShadowStyle(shadowLevel ?? SHADOW_DEFAULT_LEVEL, tokens)
          : ({} as ViewStyle);
      const safe: ViewStyle = composeSafeAreaPadding({
        mode: safeArea ?? false,
        safeTop,
        insets,
        spacing,
      });

      return {
        ...(backgroundColor ? { backgroundColor } : null),
        ...spacing,
        ...flexbox,
        ...rounding,
        ...border,
        ...shadowStyle,
        ...safe,
      } as ViewStyle;
    }, [
      backgroundColor,
      tokens,
      p,
      px,
      py,
      pt,
      pb,
      pl,
      pr,
      m,
      mx,
      my,
      mt,
      mb,
      ml,
      mr,
      gap,
      rowGap,
      columnGap,
      row,
      center,
      align,
      justify,
      wrap,
      flex,
      grow,
      shrink,
      rounded,
      borderRadius,
      roundedTop,
      roundedBottom,
      roundedLeft,
      roundedRight,
      borderWidth,
      borderTopWidth,
      borderBottomWidth,
      borderLeftWidth,
      borderRightWidth,
      borderColor,
      borderResolvedColor,
      shadow,
      shadowLevel,
      safeTop,
      safeArea,
      insets,
    ]);

    const ripple: PressableAndroidRippleConfig | undefined = useMemo(() => {
      if (!androidRipple) return undefined;
      if (androidRipple && typeof androidRipple === 'object') return androidRipple;
      const tokenName = rippleColorName ?? DEFAULT_RIPPLE_COLOR_NAME;
      const tokenColor = tokens[tokenName];
      const color = rippleColor ?? tokenColor;
      return { color, borderless: false };
    }, [androidRipple, rippleColor, rippleColorName, tokens]);

    const defaultHitSlop: Insets = APP_PRESSABLE_DEFAULTS.hitSlop as Insets;
    const role: AccessibilityRole | undefined =
      accessibilityRole ?? (onPress ? 'button' : undefined);

    // Animate background color on press
    const handlePressIn = (e: any) => {
      Animated.timing(pressedAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
      }).start();
      onPressIn?.(e);
    };

    const handlePressOut = (e: any) => {
      Animated.timing(pressedAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
      onPressOut?.(e);
    };

    // Interpolate background color for smooth fade effect
    const animatedBackgroundColor = pressedBackgroundColor
      ? pressedAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [backgroundColor || 'transparent', pressedBackgroundColor],
        })
      : undefined;

    return (
      <Animated.View
        style={[
          base,
          animatedBackgroundColor ? { backgroundColor: animatedBackgroundColor } : null,
          style,
        ]}
      >
        <Pressable
          ref={ref}
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          accessibilityRole={role}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          onLayout={onCollapseLayout}
          hitSlop={hitSlop ?? defaultHitSlop}
          android_ripple={Platform.OS === 'android' ? ripple : undefined}
          style={({ pressed }) => [
            // Inner carries flexbox so children arrange via row/center/gap.
            // (Outer Animated.View keeps the chrome — bg/border/rounded/padding.)
            // Only fill the wrapper when explicitly requested via `fillContainer`.
            fillContainer ? { flex: 1, width: '100%', height: '100%' } : null,
            innerLayout,
            pressed && !pressedBackgroundColor
              ? pressedScale && pressedScale !== 1
                ? {
                    opacity: pressedOpacity,
                    transform: [{ scale: pressedScale }],
                  }
                : {
                    opacity: pressedOpacity,
                  }
              : pressed && pressedScale && pressedScale !== 1
                ? {
                    transform: [{ scale: pressedScale }],
                  }
                : null,
          ]}
          {...other}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  },
);

export const AppPressableView = memo(AppPressableViewBase);
