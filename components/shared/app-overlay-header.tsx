import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export type AppOverlayHeaderProps = {
  title?: string;
  /** Optional fallback when there's nothing on the back stack
   *  (cold-launch / deep-link into a sub-screen). */
  fallbackHref?: string;
  onBack?: () => void;
  /** Right-slot content. */
  right?: ReactNode;
  /** Override the back icon's accessibility label. */
  backAccessibilityLabel?: string;
  /** Hide the back affordance (e.g. on a root screen reusing the layout). */
  hideBack?: boolean;
  /** Hairline divider at the bottom. Default true. */
  showDivider?: boolean;
};

/**
 * Generic in-flow header pattern (safe-area top inset + 56dp content row
 * + optional bottom divider) used by `AppSettingsHeader` and the auth
 * screens. Lives in /shared so other surfaces don't reinvent the same
 * three-column flex layout.
 *
 * Three-column flex (1fr/1fr/1fr) keeps the title dead-centered
 * regardless of what's in the right slot.
 */
export function AppOverlayHeader({
  title,
  fallbackHref,
  onBack,
  right,
  backAccessibilityLabel = 'Go back',
  hideBack = false,
  showDivider = true,
}: AppOverlayHeaderProps) {
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    triggerHaptic('selection');
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref) {
      router.replace(fallbackHref as never);
    }
  };

  return (
    <AppView
      colorName="background"
      style={{
        paddingTop: insets.top,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: tokens.divider,
      }}
    >
      <AppView row align="center" px="lg" pt="md" pb="md" style={{ minHeight: 56 }}>
        <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
          {hideBack ? null : (
            <AppPressableView
              center
              rounded={999}
              onPress={handleBack}
              androidRipple
              accessibilityRole="button"
              accessibilityLabel={backAccessibilityLabel}
              style={{
                width: 36,
                height: 36,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
              }}
            >
              <ArrowLeft size={18} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
          )}
        </AppView>

        <AppView style={{ flex: 1, alignItems: 'center' }}>
          {title ? (
            <AppText textVariant="bodySm" weight="semibold" align="center">
              {title}
            </AppText>
          ) : null}
        </AppView>

        <AppView style={{ flex: 1, alignItems: 'flex-end' }}>{right ?? null}</AppView>
      </AppView>
    </AppView>
  );
}

export default AppOverlayHeader;
