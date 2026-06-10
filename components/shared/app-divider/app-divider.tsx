import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useThemeContext } from '@/contexts/theme.context';
import type { ColorName } from '@/themes';

export type AppDividerProps = {
  /** Theme token name to color the line. Defaults to `divider`. */
  colorName?: ColorName;
  /** Hairline by default — set explicitly for a thicker rule. */
  thickness?: number;
  /** Opacity 0–1. Defaults to 1. */
  opacity?: number;
  /** Margin above/below the line. */
  spacing?: number;
  /** 'horizontal' (default) draws a 1px high line; 'vertical' draws a
   *  1px wide line that stretches with its parent's height. */
  orientation?: 'horizontal' | 'vertical';
  style?: StyleProp<ViewStyle>;
};

/**
 * Thin one-pixel rule used between sections, inside cards, etc.
 * Replaces ad-hoc `<View style={{ height: 1, backgroundColor: divider }} />`
 * blocks scattered across the app.
 */
export function AppDivider({
  colorName = 'divider',
  thickness,
  opacity = 1,
  spacing,
  orientation = 'horizontal',
  style,
}: AppDividerProps) {
  const { tokens } = useThemeContext();
  const t = thickness ?? StyleSheet.hairlineWidth;
  const baseStyle: ViewStyle =
    orientation === 'horizontal'
      ? {
          height: t,
          alignSelf: 'stretch',
          marginVertical: spacing,
        }
      : {
          width: t,
          alignSelf: 'stretch',
          marginHorizontal: spacing,
        };
  return (
    <View
      style={[
        baseStyle,
        { backgroundColor: tokens[colorName], opacity },
        style,
      ]}
    />
  );
}

export default AppDivider;
