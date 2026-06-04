import React, { memo, useCallback, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppIcon, type Family } from '@/components/shared/app-icon';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { type ColorName } from '@/themes';
import type { ThemeTokens } from '@/themes/types';
import { triggerHaptic, type HapticKind } from '@/utils/haptics';

export type ChipVariant = 'solid' | 'outline' | 'ghost';
export type ChipKind =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';
export type ChipSize = 'sm' | 'md';

export type AppChipProps = {
  label: string;
  variant?: ChipVariant;
  kind?: ChipKind;
  size?: ChipSize;
  pill?: boolean;
  /** Optional override for chip background using theme tokens */
  backgroundColorName?: ColorName;
  labelColorName?: ColorName;
  startIcon?: { name: string; family?: Family } | null;
  endIcon?: { name: string; family?: Family } | null;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onRemove?: () => void;
  removeIcon?: { name: string; family?: Family; color?: string; colorName?: ColorName };
  disabled?: boolean;
  haptics?: HapticKind;
  enableRipple?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderColorName?: ColorName;
  /** Increase/customize touch target area */
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  /** Animate press scale (default false) */
  enableAnimatedPress?: boolean;
  /** Target scale when pressed if animation enabled */
  pressedScale?: number;
  /** Typography accessibility */
  allowFontScaling?: boolean;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
};

const SIZE_MAP: Record<
  ChipSize,
  { px: number; py: number; radius: number; gap: number; textVariant: 'bodyXs' | 'bodySm' }
> = {
  sm: { px: 10, py: 6, radius: 36, gap: 8, textVariant: 'bodyXs' },
  md: { px: 12, py: 8, radius: 36, gap: 10, textVariant: 'bodySm' },
};

function resolveColors(
  tokens: ThemeTokens,
  scheme: 'light' | 'dark',
  variant: ChipVariant,
  kind: ChipKind,
  selected?: boolean,
  borderColorName?: ColorName,
) {
  const tints: Record<ChipKind, { bg: string; fg: string }> = {
    neutral: { bg: tokens.card, fg: tokens.onCard },
    primary: { bg: tokens.primaryBg, fg: tokens.onPrimary },
    secondary: { bg: tokens.backgroundSecondary, fg: tokens.background },
    success: { bg: tokens.success, fg: scheme === 'light' ? tokens.white : tokens.onBackground },
    warning: { bg: tokens.warning, fg: scheme === 'light' ? tokens.black : tokens.onBackground },
    error: { bg: tokens.error, fg: scheme === 'light' ? tokens.white : tokens.onBackground },
    info: { bg: tokens.info, fg: scheme === 'light' ? tokens.white : tokens.onBackground },
  };
  const k = tints[kind] ?? tints.neutral;
  // Selected state fills background for outline/ghost
  if (selected && (variant === 'outline' || variant === 'ghost')) {
    return { bg: k.bg, fg: k.fg, border: undefined as string | undefined };
  }
  if (variant === 'solid') return { bg: k.bg, fg: k.fg, border: undefined as string | undefined };
  if (variant === 'ghost')
    return { bg: 'transparent', fg: k.bg, border: undefined as string | undefined };
  // outline
  const border = borderColorName ? tokens[borderColorName] : k.bg;
  const fg = k.bg;
  const bg = 'transparent';
  return { bg, fg, border };
}

const AppChipComponent: React.FC<AppChipProps> = ({
  label,
  variant = 'solid',
  kind = 'neutral',
  size = 'md',
  pill = true,
  backgroundColorName,
  labelColorName,
  startIcon,
  endIcon,
  selected,
  onPress,
  onLongPress,
  onRemove,
  removeIcon,
  disabled,
  haptics,
  enableRipple = true,
  style,
  contentStyle,
  borderColorName,
  hitSlop,
  enableAnimatedPress,
  pressedScale = 0.98,
  allowFontScaling,
  numberOfLines = 1,
  ellipsizeMode,
}) => {
  const { scheme, tokens } = useThemeContext();
  const sz = SIZE_MAP[size];
  // Memoize color resolution to avoid recalculation on every render
  const { bg, fg, border } = useMemo(
    () => resolveColors(tokens, scheme, variant, kind, selected, borderColorName),
    [tokens, scheme, variant, kind, selected, borderColorName],
  );
  const radius = pill ? 36 : sz.radius;

  const containerStyle = useMemo(
    () =>
      [
        backgroundColorName ? null : { backgroundColor: bg },
        disabled ? { opacity: 0.5 } : null,
        style,
      ] as StyleProp<ViewStyle>,
    [backgroundColorName, bg, disabled, style],
  );
  // Memoize press handlers
  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptics) triggerHaptic(haptics);
    onPress?.();
  }, [disabled, haptics, onPress]);

  const handleLongPress = useCallback(() => {
    if (disabled) return;
    if (haptics) triggerHaptic(haptics);
    onLongPress?.();
  }, [disabled, haptics, onLongPress]);

  const handleRemove = useCallback(() => {
    if (disabled) return;
    triggerHaptic(haptics ?? 'selection');
    onRemove?.();
  }, [disabled, haptics, onRemove]);

  const content = (
    <AppView row align="center" gap={sz.gap} style={contentStyle}>
      {startIcon ? (
        <AppIcon
          family={startIcon.family ?? 'symbol'}
          name={startIcon.name}
          size={size === 'sm' ? 'xs' : 'sm'}
          color={fg}
        />
      ) : null}
      <AppText
        textVariant={sz.textVariant}
        weight="medium"
        colorName={labelColorName}
        style={labelColorName ? undefined : { color: fg }}
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
        allowFontScaling={allowFontScaling}
      >
        {label}
      </AppText>
      {endIcon ? (
        <AppIcon
          family={endIcon.family ?? 'symbol'}
          name={endIcon.name}
          size={size === 'sm' ? 'xs' : 'sm'}
          color={fg}
        />
      ) : null}
      {onRemove ? (
        <AppIcon
          family={removeIcon?.family ?? 'symbol'}
          name={removeIcon?.name ?? 'xmark.circle.fill'}
          size={size === 'sm' ? 'sm' : 'md'}
          color={removeIcon?.color}
          colorName={removeIcon?.colorName ?? 'icon'}
          onPress={handleRemove}
          hitSlop={8 as any}
        />
      ) : null}
    </AppView>
  );

  const boxProps = {
    colorName: backgroundColorName as any,
    px: sz.px,
    py: sz.py,
    rounded: radius,
    borderWidth: border ? 1 : 0,
    borderColor: border,
  } as const;

  if (onPress) {
    return (
      <AppPressableView
        {...boxProps}
        androidRipple={enableRipple}
        pressedOpacity={0.9}
        pressedScale={enableAnimatedPress ? pressedScale : 1}
        hitSlop={hitSlop as any}
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        disabled={disabled}
        style={containerStyle}
      >
        {content}
      </AppPressableView>
    );
  }

  return (
    <AppView {...boxProps} style={containerStyle}>
      {content}
    </AppView>
  );
};

export const AppChip = memo(AppChipComponent);
AppChip.displayName = 'AppChip';
export default AppChip;
