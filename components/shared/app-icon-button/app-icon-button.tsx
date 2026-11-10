import type { ComponentType } from 'react';

import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { ColorName } from '@/themes';

export type LucideLike = ComponentType<{
  size?: number;
  strokeWidth?: number;
  color?: string;
  fill?: string;
}>;

export type AppIconButtonProps = {
  /** Lucide (or any component with `size/strokeWidth/color`) icon. */
  Icon: LucideLike;
  onPress?: () => void;
  /** Square hit area in dp. Defaults to 36 (≥ 44 with hitSlop). */
  size?: number;
  /** Glyph size in dp. Defaults to 18. */
  iconSize?: number;
  /** Stroke width forwarded to the icon. */
  strokeWidth?: number;
  /** Theme token for the icon color. Defaults to `icon`. */
  colorName?: ColorName;
  /** Override icon color directly (bypasses `colorName`). */
  color?: string;
  /** Forwarded to the icon as `fill`. Useful for toggleable icons
   *  like heart / bookmark that have an "active" filled state. */
  fill?: string;
  /** Optional theme token for a filled background. */
  backgroundColorName?: ColorName;
  /** Literal background color (e.g. `'rgba(0,0,0,0.4)'` for a translucent
   *  backdrop over imagery). Wins over `backgroundColorName` when both
   *  are set. Use for floating controls whose background must NOT follow
   *  the theme — e.g. nav buttons over a hero photo. */
  backgroundColor?: string;
  /** Optional theme token for an outline border. */
  borderColorName?: ColorName;
  /** Border thickness. Only drawn when `borderColorName` is set.
   *  Defaults to 1. */
  borderWidth?: number;
  /** Corner radius. Defaults to 999 (full circle). */
  rounded?: number;
  /** Accessibility label — required for an icon-only control. */
  accessibilityLabel: string;
  disabled?: boolean;
};

/**
 * Round/rounded pressable that wraps a single icon. Replaces the
 * repeated "AppPressableView with a width/height + rounded={N} + a
 * lucide child" pattern scattered across the app.
 *
 * Bumps the tappable region to ≥ 44pt via `hitSlop` regardless of the
 * visible `size`, so accessibility floors are met even when the
 * button is rendered small.
 */
export function AppIconButton({
  Icon,
  onPress,
  size = 36,
  iconSize = 18,
  strokeWidth = 2.2,
  colorName = 'icon',
  color,
  fill,
  backgroundColorName,
  backgroundColor,
  borderColorName,
  borderWidth = 1,
  rounded = 999,
  accessibilityLabel,
  disabled,
}: AppIconButtonProps) {
  const { tokens } = useThemeContext();
  const resolvedColor = color ?? tokens[colorName];
  const resolvedBg =
    backgroundColor ?? (backgroundColorName ? tokens[backgroundColorName] : undefined);
  const resolvedBorder = borderColorName ? tokens[borderColorName] : undefined;
  const hit = Math.max(0, Math.ceil((44 - size) / 2));
  return (
    <AppPressableView
      center
      rounded={rounded}
      androidRipple={false}
      pressedOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hit > 0 ? { top: hit, bottom: hit, left: hit, right: hit } : undefined}
      style={{
        width: size,
        height: size,
        backgroundColor: resolvedBg,
        borderWidth: resolvedBorder ? borderWidth : 0,
        borderColor: resolvedBorder,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {/* Lucide spreads props over its `fill: "none"` default, so an explicit
       *  `fill={undefined}` drops it and react-native-svg fills the path black —
       *  an open glyph like Check turns into a solid wedge. Forward it only when set. */}
      <Icon
        size={iconSize}
        strokeWidth={strokeWidth}
        color={resolvedColor}
        {...(fill !== undefined ? { fill } : null)}
      />
    </AppPressableView>
  );
}

export default AppIconButton;
