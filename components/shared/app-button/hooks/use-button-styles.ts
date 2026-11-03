import { useThemeContext } from '@/contexts/theme.context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useCallback, useMemo } from 'react';
import {
  Platform,
  type PressableAndroidRippleConfig,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { ButtonKind, ButtonSize, ButtonVariant } from '../app-button';
import { kindTint, solidDefaults } from '../colors';
import { DEFAULT_RADIUS, SIZE_MAP } from '../tokens';

export type UseButtonStylesParams = {
  scheme: 'light' | 'dark';
  variant: ButtonVariant;
  kind: ButtonKind;
  size: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  loadingVariant: 'replace' | 'overlay' | 'inline-start';
  fullWidth?: boolean;
  rounded?: number;
  gapOverride?: number;
  iconColor?: string;
  enablePressedOverlay: boolean;
  enableRipple: boolean;
  rippleColor?: string;
  rippleRadius?: number;
  rippleBorderless?: boolean;
  enablePressedElevation?: boolean;
  pressedElevation?: number;
};

export type UseButtonStylesResult = {
  baseStyle: ViewStyle;
  variantStyle: ViewStyle;
  contentStyle: ViewStyle;
  labelStyle: TextStyle;
  resolvedIconColor: string;
  iconSize: number;
  fontSize: number;
  spinnerSize: 'small' | 'large';
  rippleConfig?: PressableAndroidRippleConfig;
  getPressedStyle: (isPressed: boolean, interactionDisabled: boolean) => ViewStyle | null;
  defaultTextVariant: import('@/themes').TextVariant;
};

export function useButtonStyles(params: UseButtonStylesParams): UseButtonStylesResult {
  const {
    variant,
    kind,
    size,
    disabled,
    loading,
    loadingVariant,
    fullWidth,
    rounded,
    gapOverride,
    iconColor,
    enablePressedOverlay,
    enableRipple,
    rippleColor,
    rippleRadius,
    rippleBorderless,
    enablePressedElevation,
    pressedElevation,
  } = params;

  const { tokens } = useThemeContext();

  const { pv, ph, gap, font, icon, textVariant } = SIZE_MAP[size];
  const spacing = gapOverride ?? gap;

  const cornerRadius = useMemo(
    () => (typeof rounded === 'number' ? rounded : DEFAULT_RADIUS),
    [rounded],
  );
  const baseStyle = useMemo<ViewStyle>(
    () => ({
      opacity: disabled ? 0.6 : 1,
      borderRadius: cornerRadius,
      width: fullWidth ? '100%' : undefined,
      position: loading && loadingVariant === 'overlay' ? 'relative' : undefined,
    }),
    [disabled, cornerRadius, fullWidth, loading, loadingVariant],
  );

  const { bg, fg, pressed } = useMemo(() => solidDefaults(tokens, kind), [tokens, kind]);
  const tint = useMemo(() => kindTint(tokens, kind), [tokens, kind]);

  const disabledBg = useThemeColor({}, 'disabledBg');
  const disabledFg = useThemeColor({}, 'disabledFg');
  const outlineOverlay = useThemeColor({}, 'outlinePressedOverlay');
  const ghostOverlay = useThemeColor({}, 'ghostPressedOverlay');
  const linkOverlay = useThemeColor({}, 'linkPressedOverlay');

  const variantStyle = useMemo<ViewStyle>(() => {
    if (variant === 'solid') {
      if (kind === 'secondary' && !disabled) {
        return {
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: tokens.secondaryBorder,
        } as ViewStyle;
      }
      return { backgroundColor: disabled ? disabledBg : bg } as ViewStyle;
    }
    if (variant === 'outline')
      return {
        borderWidth: 1,
        borderColor: disabled ? disabledFg : tint,
        backgroundColor: 'transparent',
      } as ViewStyle;
    return { backgroundColor: 'transparent' } as ViewStyle;
  }, [variant, kind, tokens.secondaryBorder, bg, disabled, disabledBg, disabledFg, tint]);

  const contentStyle = useMemo<ViewStyle>(
    () => ({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: pv,
      paddingHorizontal: ph,
      gap: spacing,
    }),
    [pv, ph, spacing],
  );

  const labelStyle = useMemo<TextStyle>(() => {
    if (disabled) return { color: disabledFg } as TextStyle;
    if (variant === 'solid') return { color: fg } as TextStyle;
    return {
      color: tint,
      textDecorationLine: variant === 'link' ? 'underline' : undefined,
    } as TextStyle;
  }, [variant, fg, tint, disabled, disabledFg]);

  const resolvedIconColor = useMemo(
    () => iconColor ?? (labelStyle.color as string) ?? tint,
    [iconColor, labelStyle.color, tint],
  );

  const spinnerSize: 'small' | 'large' = useMemo(
    () => (size === 'xs' || size === 'sm' ? 'small' : 'large'),
    [size],
  );

  const rippleConfig = useMemo<PressableAndroidRippleConfig | undefined>(() => {
    if (!enableRipple || Platform.OS !== 'android') return undefined;
    const color = rippleColor ?? (variant === 'solid' ? (fg as string) : (tint as string));
    return {
      color,
      radius: rippleRadius,
      borderless: rippleBorderless,
    };
  }, [enableRipple, rippleColor, rippleRadius, rippleBorderless, variant, fg, tint]);

  const getPressedStyle = useCallback(
    (isPressed: boolean, interactionDisabled: boolean) => {
      if (!isPressed || interactionDisabled) return null;
      const pressedStyle: ViewStyle = {};
      if (variant === 'solid' && pressed) {
        pressedStyle.backgroundColor = pressed;
      } else if (enablePressedOverlay) {
        const overlay =
          variant === 'outline' ? outlineOverlay : variant === 'ghost' ? ghostOverlay : linkOverlay;
        pressedStyle.backgroundColor = overlay as string;
      }
      if (
        Platform.OS === 'android' &&
        enablePressedElevation &&
        variant === 'solid' &&
        !disabled &&
        !loading
      ) {
        pressedStyle.elevation = pressedElevation ?? 2;
      }
      return Object.keys(pressedStyle).length ? pressedStyle : null;
    },
    [
      variant,
      pressed,
      enablePressedOverlay,
      outlineOverlay,
      ghostOverlay,
      linkOverlay,
      enablePressedElevation,
      pressedElevation,
      disabled,
      loading,
    ],
  );

  return {
    baseStyle,
    variantStyle,
    contentStyle,
    labelStyle,
    resolvedIconColor,
    iconSize: icon,
    fontSize: font,
    spinnerSize,
    rippleConfig,
    getPressedStyle,
    defaultTextVariant: textVariant,
  };
}
