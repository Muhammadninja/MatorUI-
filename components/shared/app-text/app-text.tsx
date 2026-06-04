import { forwardRef, memo, useMemo } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import {
  getTextStyle,
  getWeightStyle,
  type ColorName,
  type FontFamilyName,
  type TextVariant,
  type WeightName,
} from '@/themes';
import { useTextDefaults } from './text-defaults.context';
import { TEXT_DEFAULTS } from './tokens';

type Weight = WeightName;

export type AppTextProps = Omit<TextProps, 'style'> & {
  style?: StyleProp<TextStyle>;
  lightColor?: string;
  darkColor?: string;
  /** Theme color token to use (falls back to 'text') */
  colorName?: ColorName;
  /** Semantic typography variant from theme */
  textVariant?: TextVariant;
  /** Optional explicit font size override */
  fontSize?: number;
  /** Optional: override font family when using textVariant */
  family?: FontFamilyName;
  /** Optional font weight helper */
  weight?: Weight;
  /** Optional text alignment */
  align?: TextStyle['textAlign'];
  /** Reduce emphasis (applies opacity) */
  muted?: boolean;
  /** Convenience: apply text transform (capitalize/uppercase/lowercase) */
  transform?: TextStyle['textTransform'];
  /** Convenience: italic font style */
  italic?: boolean;
  /** Convenience: underline text */
  underline?: boolean;
  /** Convenience: strike-through text */
  strike?: boolean;
};

const weightToStyle = (w: Weight | undefined) => (w ? getWeightStyle(w) : undefined);

const AppTextImpl = forwardRef<Text, AppTextProps>(function AppText(props, ref) {
  const {
    lightColor,
    darkColor,
    colorName,
    textVariant,
    family,
    fontSize,
    weight,
    align,
    muted,
    style,
    italic,
    transform,
    underline,
    strike,
    ...rest
  } = props;

  const defaults = useTextDefaults();
  const resolvedColorName = colorName ?? defaults.colorName ?? TEXT_DEFAULTS.colorName;
  const resolvedWeight = weight ?? defaults.weight;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, resolvedColorName);

  const variantStyle = useMemo(
    () => getTextStyle(textVariant ?? defaults.textVariant, family ?? defaults.family),
    [textVariant, family, defaults.textVariant, defaults.family],
  );
  const weightStyle = useMemo(() => weightToStyle(resolvedWeight), [resolvedWeight]);
  const alignStyle = useMemo(
    () => (align ? ({ textAlign: align } as TextStyle) : undefined),
    [align],
  );
  const mutedStyle = useMemo(
    () => (muted ? ({ opacity: defaults.mutedOpacity } as TextStyle) : undefined),
    [muted, defaults.mutedOpacity],
  );
  const italicStyle = useMemo(
    () => (italic ? ({ fontStyle: 'italic' } as TextStyle) : undefined),
    [italic],
  );
  const transformStyle = useMemo(
    () => (transform ? ({ textTransform: transform } as TextStyle) : undefined),
    [transform],
  );
  const fontSizeStyle = useMemo(
    () => (fontSize ? ({ fontSize } as TextStyle) : undefined),
    [fontSize],
  );
  const decorationStyle = useMemo(() => {
    if (!underline && !strike) return undefined;
    const textDecorationLine: TextStyle['textDecorationLine'] =
      underline && strike ? 'underline line-through' : underline ? 'underline' : 'line-through';
    return { textDecorationLine } as TextStyle;
  }, [underline, strike]);

  return (
    <Text
      ref={ref}
      style={[
        { color },
        variantStyle,
        fontSizeStyle,
        weightStyle,
        alignStyle,
        italicStyle,
        transformStyle,
        decorationStyle,
        mutedStyle,
        style,
      ]}
      {...rest}
    />
  );
});

export const AppText = memo(AppTextImpl);
AppText.displayName = 'AppText';
