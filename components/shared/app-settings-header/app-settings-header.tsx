import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/** Visible (post-safe-area) height of the header. Kept exported for any
 *  consumer that still needs the number for layout calculations. */
export const SETTINGS_HEADER_HEIGHT = 56;
export const HEADER_TITLE_SIZE = 17;
/** Size of the round back button; a right-slot action should match it so the
 *  title sits on the screen's center line. */
export const HEADER_ACTION_SIZE = 36;

export type AppSettingsHeaderProps = {
  title: string;
  /** Optional fallback route when there's nothing on the back stack
   *  (deep link / cold launch directly into the screen). */
  fallbackHref?: string;
  /** Override the default back behavior — useful when the screen has
   *  an internal sub-state (e.g. "New Address" form) that should be
   *  dismissed without leaving the screen. */
  onBack?: () => void;
  /** Optional right-slot content (e.g. a "Close" / "Edit" / "Save" link). */
  right?: ReactNode;
  /** Override the back icon's accessibility label. */
  backAccessibilityLabel?: string;
};

/**
 * In-flow screen header for profile sub-routes.
 *
 * Render this above the scroll view (NOT absolutely positioned). The
 * header carries its own top safe-area inset, and a hairline divider at
 * the bottom separates it from the scrolling content. No blur — content
 * does not pass under it, so consumers don't need a `paddingTop` offset.
 *
 * Three-column flex (1fr / 1fr / 1fr) keeps the title dead-centered
 * regardless of what's in the right slot.
 */
export function AppSettingsHeader({
  title,
  fallbackHref,
  onBack,
  right,
  backAccessibilityLabel,
}: AppSettingsHeaderProps) {
  const { t } = useTranslation();
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
        borderBottomWidth: 1,
        borderBottomColor: tokens.divider,
      }}
    >
      <AppView
        row
        align="center"
        px={16}
        pt={12}
        pb={12}
        style={{ minHeight: SETTINGS_HEADER_HEIGHT }}
      >
        {/* Back button (fixed width). The title takes ALL remaining space so it
            never truncates in a 1/3 column; a matching-width spacer on the right
            keeps it centered when there's no right slot. */}
        <AppPressableView
          center
          rounded={999}
          onPress={handleBack}
          androidRipple
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel ?? t('common.back')}
          style={{
            width: HEADER_ACTION_SIZE,
            height: HEADER_ACTION_SIZE,
            flexShrink: 0,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
          }}
        >
          <ArrowLeft size={18} strokeWidth={2.2} color={tokens.text} />
        </AppPressableView>

        <AppView style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
          {/* A screen title, not a caption: 17pt like the platform's own nav
              titles. It wraps to a second line rather than shrinking. */}
          <AppText
            weight="semibold"
            align="center"
            style={{ fontSize: HEADER_TITLE_SIZE, lineHeight: 22, color: tokens.text }}
          >
            {title}
          </AppText>
        </AppView>

        <AppView style={{ minWidth: HEADER_ACTION_SIZE, alignItems: 'flex-end', flexShrink: 0 }}>
          {right ?? null}
        </AppView>
      </AppView>
    </AppView>
  );
}

export default AppSettingsHeader;
