import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type AppRowItemProps = {
  /** Left-slot — icon box, avatar, image. Optional. */
  leading?: ReactNode;
  title: string;
  /** Secondary text under the title. */
  subtitle?: string;
  /** Right-slot. Mutually exclusive with `rightText` + `rightChevron`. */
  trailing?: ReactNode;
  /** Convenience for the common "right-aligned status/value text" pattern. */
  rightText?: string;
  /** Convenience for the most common trailing affordance. */
  rightChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Default `lg` (16). Override per surface. */
  px?: 'sm' | 'md' | 'lg';
};

/**
 * Canonical list row.
 *
 * Replaces the ad-hoc "AppView row + icon + 2-line text + chevron" markup
 * scattered across profile, settings, notifications, payment-methods,
 * shipping-addresses screens. Drop in instead of re-inventing.
 *
 * Tap target floor is 56dp (a11y), height grows with multi-line subtitle.
 */
export function AppRowItem({
  leading,
  title,
  subtitle,
  trailing,
  rightText,
  rightChevron,
  onPress,
  disabled,
  accessibilityLabel,
  px = 'lg',
}: AppRowItemProps) {
  const { tokens } = useThemeContext();

  const inner = (
    <AppView row align="center" gap="md" px={px} py="md" style={{ minHeight: 56 }}>
      {leading ? <AppView>{leading}</AppView> : null}
      <AppView flex={1} gap="xs">
        <AppText textVariant="bodySemibold" weight="semibold" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText textVariant="bodyXs" colorName="gray400" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </AppView>
      {trailing ?? (
        <AppView row align="center" gap="sm">
          {rightText ? (
            <AppText textVariant="bodySm" colorName="gray400">
              {rightText}
            </AppText>
          ) : null}
          {rightChevron ? (
            <ChevronRight size={16} strokeWidth={2.2} color={tokens.gray400} />
          ) : null}
        </AppView>
      )}
    </AppView>
  );

  if (!onPress) return inner;

  return (
    <AppPressableView
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      pressedOpacity={0.7}
    >
      {inner}
    </AppPressableView>
  );
}

export default AppRowItem;
