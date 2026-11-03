import type { ReactNode } from 'react';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type AppSectionHeaderProps = {
  title: string;
  /** Right-side affordance — typically a "See all" link. Mutually
   *  exclusive with the convenience `actionLabel`/`onAction` shortcut. */
  trailing?: ReactNode;
  /** Convenience for the common text-link action. */
  actionLabel?: string;
  onAction?: () => void;
  /** Match the surrounding section's horizontal rhythm. Default `lg`. */
  px?: 'sm' | 'md' | 'lg';
};

/**
 * Section header pair used above lists, cards, and grouped rows.
 *
 * Replaces ~30 inline copies of the same "row with bold title left,
 * grey text-button right" markup. Defaults keep the title flush with the
 * adjacent list / card surface horizontally.
 */
export function AppSectionHeader({
  title,
  trailing,
  actionLabel,
  onAction,
  px = 'lg',
}: AppSectionHeaderProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView row align="center" justify="space-between" px={px}>
      <AppText textVariant="subtitle" family="accent" weight="semibold" colorName="text">
        {title}
      </AppText>
      {trailing ??
        (actionLabel && onAction ? (
          <AppPressableView
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            pressedOpacity={0.7}
            px="sm"
            py="xs"
          >
            <AppText
              textVariant="bodySm"
              weight="semibold"
              style={{ color: tokens.brandText }}
            >
              {actionLabel}
            </AppText>
          </AppPressableView>
        ) : null)}
    </AppView>
  );
}

export default AppSectionHeader;
