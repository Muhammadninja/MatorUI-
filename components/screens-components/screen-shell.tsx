import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type ScreenShellProps = {
  topSlot?: ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
};

export function ScreenShell({ topSlot, eyebrow, title, description, children }: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useThemeContext();

  return (
      <AppView flex={1} colorName="background" safeArea="top">
        {topSlot}
        {eyebrow ? (
          <AppText textVariant="caption" family="accent" colorName="gray400" transform="uppercase">
            {eyebrow}
          </AppText>
        ) : null}
        {title ? (
          <AppText textVariant="title" family="heading" colorName="text">
            {title}
          </AppText>
        ) : null}
        {description ? (
          <AppText textVariant="body" family="default" colorName="gray400">
            {description}
          </AppText>
        ) : null}
        {children}
    </AppView>
  );
}

export default ScreenShell;
