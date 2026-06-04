import {
  Pressable,
  Text,
  View,
  type Insets,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import type { ColorName } from '@/themes';

export type Family = 'symbol' | 'custom' | 'material';

const SIZE_MAP = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

const GLYPH_MAP: Record<string, string> = {
  'chevron.left': '‹',
  'chevron.right': '›',
  'xmark.circle.fill': '✕',
  'icons-arrow-right-2': '›',
  'keyboard-hide': '⌄',
};

export type AppIconProps = {
  name: string;
  family?: Family;
  size?: keyof typeof SIZE_MAP | number;
  color?: string;
  colorName?: ColorName;
  onPress?: () => void;
  disabled?: boolean;
  hitSlop?: Insets | number;
  preserveImageColor?: boolean;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export function AppIcon({
  name,
  size = 'md',
  color,
  colorName = 'icon',
  onPress,
  disabled,
  hitSlop,
  style,
  containerStyle,
}: AppIconProps) {
  const themeColor = useThemeColor({}, colorName);
  const resolvedColor = color ?? themeColor;
  const fontSize = typeof size === 'number' ? size : SIZE_MAP[size];
  const glyph = GLYPH_MAP[name] ?? '•';
  const content = (
    <View style={containerStyle}>
      <Text style={[{ color: resolvedColor, fontSize, lineHeight: fontSize }, style]}>{glyph}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={hitSlop}>
      {content}
    </Pressable>
  );
}

export default AppIcon;
