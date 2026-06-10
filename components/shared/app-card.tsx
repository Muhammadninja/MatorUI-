import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type AppCardProps = {
  children: ReactNode;
  /** Tap target — if provided the card becomes pressable. */
  onPress?: () => void;
  /** Override the default `tokens.card` fill. */
  backgroundColor?: string;
  /** Padding. Defaults to `lg`. */
  px?: 'sm' | 'md' | 'lg' | 'xl';
  py?: 'sm' | 'md' | 'lg' | 'xl';
  /** Corner radius. Defaults to 16. */
  rounded?: number;
  /** Border. Defaults to a 1px `tokens.border` outline. */
  border?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * Bordered card surface — typed wrapper around the recurring
 * "rounded rectangle + 1px border + padding" pattern (order rows,
 * profile section cards, terms accordion, empty-state cards).
 *
 * If `onPress` is provided, renders as `AppPressableView` so the press
 * affordance is correct without callers having to know which primitive
 * to reach for. Otherwise renders a plain `AppView` so it can sit inside
 * scroll regions without consuming touches.
 */
export function AppCard({
  children,
  onPress,
  backgroundColor,
  px = 'lg',
  py = 'lg',
  rounded = 16,
  border = true,
  style,
  disabled,
  accessibilityLabel,
}: AppCardProps) {
  const { tokens } = useThemeContext();
  const surface: ViewStyle = {
    backgroundColor: backgroundColor ?? tokens.card,
    borderWidth: border ? 1 : 0,
    borderColor: tokens.border,
  };

  if (onPress) {
    return (
      <AppPressableView
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        pressedOpacity={0.88}
        pressedScale={0.99}
        px={px}
        py={py}
        rounded={rounded}
        style={[surface, style]}
      >
        {children}
      </AppPressableView>
    );
  }
  return (
    <AppView px={px} py={py} rounded={rounded} style={[surface, style]}>
      {children}
    </AppView>
  );
}

export default AppCard;
