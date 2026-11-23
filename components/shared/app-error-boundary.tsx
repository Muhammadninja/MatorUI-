import { AlertTriangle } from 'lucide-react-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { Sentry } from '@/services/sentry';

export type AppErrorBoundaryProps = {
  children: ReactNode;
  /** Surfaced inline so the user understands which slice failed. Keep
   *  it short — "this screen" reads better than "ItemDetailRoute". */
  label?: string;
  /** Override the default centered fallback (e.g. for a screen-shell
   *  variant that fills the safe area). Receives a `retry` callback that
   *  resets the boundary's internal state so the children can re-render. */
  fallback?: (state: { error: Error; retry: () => void; label: string }) => ReactNode;
  /** Extra side-channel on top of the Sentry report every boundary sends. */
  onError?: (error: Error, info: ErrorInfo) => void;
};

type State = { error: Error | null };

/**
 * Wraps a slice of the tree in a React error boundary. Each heavy screen
 * gets its own — a crash in ai-chat shouldn't take down the tab bar,
 * a crash in an order detail shouldn't lose the order-list above it.
 *
 * Usage:
 *   <AppErrorBoundary label="this screen">
 *     <SomeHeavyScreen />
 *   </AppErrorBoundary>
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The fallback swallows the crash, so without this it never reached Sentry.
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack ?? '' } },
      tags: { boundary: this.props.label ?? 'this screen' },
    });
    this.props.onError?.(error, info);
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const label = this.props.label ?? 'this screen';
    if (this.props.fallback) {
      return this.props.fallback({ error, retry: this.retry, label });
    }
    return <DefaultFallback error={error} retry={this.retry} label={label} />;
  }
}

function DefaultFallback({
  error,
  retry,
  label,
}: {
  error: Error;
  retry: () => void;
  label: string;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView flex={1} center colorName="background" px="xl" gap="lg">
      <AppView
        center
        rounded={999}
        style={{ width: 56, height: 56, backgroundColor: `${tokens.warning}1A` }}
      >
        <AlertTriangle size={26} strokeWidth={2.1} color={tokens.warning} />
      </AppView>
      <AppView gap="sm" align="center">
        <AppText textVariant="bodySemibold" weight="semibold" align="center">
          {t('errorBoundary.somethingWrong', { label })}
        </AppText>
        <AppText textVariant="bodySm" colorName="gray400" align="center">
          {__DEV__ ? error.message : t('errorBoundary.pleaseTryAgain')}
        </AppText>
      </AppView>
      <AppButton title={t('common.tryAgain')} onPress={retry} kind="brand" size="md" />
    </AppView>
  );
}

export default AppErrorBoundary;
