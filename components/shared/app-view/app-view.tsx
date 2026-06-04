import { useThemeContext } from '@/contexts/theme.context';
import { getShadowStyle, type ColorName } from '@/themes';
import { forwardRef, memo, useMemo } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorToken, useResolvedBackgroundColor } from './colors';
import { composeSafeAreaPadding } from './safe-area';
import { composeBorder, composeFlexbox, composeRounding, composeSpacing } from './style-compose';
import { SHADOW_DEFAULT_LEVEL } from './tokens';

export type AppViewProps = Omit<ViewProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  lightColor?: string;
  darkColor?: string;
  /** Theme color token to use for background. If omitted, no background is applied. */
  colorName?: ColorName;
  p?: number; // padding
  px?: number;
  py?: number;
  pt?: number;
  pb?: number;
  pl?: number;
  pr?: number;
  m?: number; // margin
  mx?: number;
  my?: number;
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
  /** Gap between children (requires RN 0.71+) */
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  /** Rounded corners (number maps to borderRadius) */
  rounded?: number;
  roundedTop?: number;
  roundedBottom?: number;
  roundedLeft?: number;
  roundedRight?: number;
  /** Borders */
  borderWidth?: number;
  borderColor?: string;
  borderName?: ColorName;
  borderTopWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  /** Simple shadow toggle */
  shadow?: boolean;
  /** Shadow intensity (overrides shadow) */
  shadowLevel?: 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12;
  /** Flexbox helpers */
  row?: boolean;
  center?: boolean; // center content both axes
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  flex?: number;
  grow?: number;
  shrink?: number;
  /** Wrap with SafeAreaView padding at the top on iOS */
  safeTop?: boolean;
  /** Apply safe area padding: true|'top'|'bottom'|'vertical'|'horizontal'|'all' */
  safeArea?: boolean | 'top' | 'bottom' | 'vertical' | 'horizontal' | 'all';
};

const AppViewBase = forwardRef<View, AppViewProps>(function AppView(
  {
    style,
    lightColor,
    darkColor,
    colorName,
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
    rounded,
    roundedTop,
    roundedBottom,
    roundedLeft,
    roundedRight,
    borderWidth,
    borderColor,
    borderName,
    borderTopWidth,
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,
    shadow,
    shadowLevel,
    row,
    center,
    align,
    justify,
    wrap,
    flex,
    grow,
    shrink,
    safeTop,
    safeArea,
    ...otherProps
  },
  ref,
) {
  const { tokens } = useThemeContext();
  const backgroundColor = useResolvedBackgroundColor({ lightColor, darkColor, colorName });
  const borderResolvedColor = useColorToken(borderName);
  const insets = useSafeAreaInsets();

  const composed = useMemo<ViewStyle>(() => {
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

    // Safe area padding (augment existing padding without overriding larger explicit values)
    const safe = composeSafeAreaPadding({ mode: safeArea ?? false, safeTop, insets, spacing });

    return {
      ...(backgroundColor ? { backgroundColor } : null),
      ...spacing,
      ...flexbox,
      ...rounding,
      ...border,
      ...(shadow || shadowLevel ? getShadowStyle(shadowLevel ?? SHADOW_DEFAULT_LEVEL, tokens) : {}),
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

  return <View ref={ref} style={[composed, style]} {...otherProps} />;
});

export const AppView = memo(AppViewBase);
