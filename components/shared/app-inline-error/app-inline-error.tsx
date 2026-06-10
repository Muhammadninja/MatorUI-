import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type AppInlineErrorProps = {
  /** Error message to display. Truncates at 2 lines. */
  message: string;
  /** Optional dismiss action. Renders a tappable "Dismiss" label when
   *  provided. */
  onDismiss?: () => void;
  /** Horizontal margin. Defaults to 20 (matches typical screen gutter). */
  mx?: number;
  /** Top margin. Defaults to 8. */
  mt?: number;
};

/**
 * Inline error banner — outlined card with an error-tinted message and
 * an optional dismiss control. Replaces the per-screen `ErrorBanner`
 * helpers (garage, etc.).
 */
export function AppInlineError({
  message,
  onDismiss,
  mx = 20,
  mt = 8,
}: AppInlineErrorProps) {
  return (
    <AppView
      mx={mx}
      mt={mt}
      px={14}
      py={10}
      rounded={14}
      row
      align="center"
      justify="space-between"
      gap={10}
      colorName="card"
      borderName="error"
      borderWidth={1}
    >
      <AppText
        textVariant="bodyXs"
        colorName="error"
        numberOfLines={2}
        style={{ flexShrink: 1 }}
      >
        {message}
      </AppText>
      {onDismiss ? (
        <AppText
          textVariant="bodyXs"
          family="accent"
          colorName="error"
          onPress={onDismiss}
          suppressHighlighting
        >
          Dismiss
        </AppText>
      ) : null}
    </AppView>
  );
}

export default AppInlineError;
