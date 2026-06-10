import type { ReactNode } from 'react';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Composer outer surface.
 *
 * The name is historical: this used to wrap a BlurView underlay on iOS,
 * but on dark mode the frosted-gray tint read as an ugly pill around the
 * input. We swapped to a solid `tokens.background` strip on both
 * platforms — cleaner and removes one source of dark-mode contrast bugs.
 */
export default function ComposerBlurWrapper({ children }: { children: ReactNode }) {
  const { tokens } = useThemeContext();
  return (
    <AppView
      pt="xs"
      style={{
        borderTopWidth: 1,
        borderTopColor: tokens.divider,
        backgroundColor: tokens.background,
      }}
    >
      {children}
    </AppView>
  );
}
