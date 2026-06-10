import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type BannerKind = 'info' | 'success' | 'warning' | 'error';

export type AppBannerProps = {
  kind?: BannerKind;
  title: string;
  /** Optional secondary line — keep to one sentence. */
  body?: string;
  /** Right-side action (e.g. dismiss "X", retry button). */
  trailing?: ReactNode;
};

const ICON: Record<
  BannerKind,
  ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

/**
 * Inline banner used for non-modal communication: API failures with a
 * retry, offline notice, success after a save, etc. Composes from the
 * theme: solid background `${kind}1A` over the screen, icon + text +
 * optional trailing action.
 */
export function AppBanner({ kind = 'info', title, body, trailing }: AppBannerProps) {
  const { tokens } = useThemeContext();
  const Icon = ICON[kind];
  const accent =
    kind === 'success'
      ? tokens.success
      : kind === 'warning'
        ? tokens.warning
        : kind === 'error'
          ? tokens.error
          : tokens.info;

  return (
    <AppView
      row
      align="flex-start"
      gap="md"
      px="lg"
      py="md"
      rounded={12}
      style={{
        borderWidth: 1,
        borderColor: accent,
        backgroundColor: `${accent}1A`,
      }}
    >
      <AppView style={{ paddingTop: 2 }}>
        <Icon size={18} strokeWidth={2.1} color={accent} />
      </AppView>
      <AppView flex={1} gap="xs">
        <AppText textVariant="bodySemibold" weight="semibold" colorName="text">
          {title}
        </AppText>
        {body ? (
          <AppText textVariant="bodyXs" colorName="gray400">
            {body}
          </AppText>
        ) : null}
      </AppView>
      {trailing ? <AppView>{trailing}</AppView> : null}
    </AppView>
  );
}

export default AppBanner;
