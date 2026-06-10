import { router } from 'expo-router';
import { ChevronRight, LogIn, Settings, UserRound } from 'lucide-react-native';
import { Platform } from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useGlobalModal } from '@/hooks/use-global-modal';
import { triggerHaptic } from '@/utils/haptics';

// Same elevation tier as the authenticated profile cards. Guest empty no
// longer speaks its own glassmorphism vocabulary.
const CARD_ELEVATION = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 6 },
});

export default function ProfileGuestEmpty() {
  const { tokens } = useThemeContext();
  const { guestId } = useUserContext();
  const { openAuthRequired } = useGlobalModal();

  const handleSettings = () => {
    triggerHaptic('selection');
    router.push('/settings-security');
  };

  const handleLogin = () => {
    triggerHaptic('selection');
    openAuthRequired({
      title: 'Welcome to Matorui',
      message:
        'Log in to access your garage and orders, or create an account to get started.',
      redirectTo: '/profile',
    });
  };

  return (
    <AppView px={16} pt={28} gap={16}>
      {/* Guest welcome card */}
      <AppView
        rounded={16}
        gap={16}
        align="center"
        py={28}
        px={20}
        style={{
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
          ...CARD_ELEVATION,
        }}
      >
        <AppView
          center
          rounded={999}
          style={{
            width: 90,
            height: 90,
            backgroundColor: tokens.backgroundSecondary,
            borderWidth: 1,
            borderColor: tokens.border,
          }}
        >
          <UserRound size={36} strokeWidth={1.6} color={tokens.gray400} />
        </AppView>

        <AppView align="center" gap={6}>
          <AppText
            textVariant="caption"
            family="accent"
            weight="semibold"
            transform="uppercase"
            style={{ color: tokens.gray400, letterSpacing: 1.4 }}
          >
            Guest session
          </AppText>
          <AppText
            textVariant="title"
            family="heading"
            weight="bold"
            colorName="text"
            style={{ letterSpacing: 2 }}
            selectable
          >
            {guestId}
          </AppText>
          <AppText
            textVariant="bodySm"
            colorName="gray400"
            style={{ textAlign: 'center', maxWidth: 260 }}
          >
            You&apos;re browsing as a guest. Your ID is only used for support and
            activity on this device.
          </AppText>
        </AppView>

        <AppButton
          kind="brand"
          size="md"
          fullWidth
          onPress={handleLogin}
          accessibilityLabel="Log in to your account"
          containerStyle={{ width: '100%', marginTop: 4 }}
        >
          <AppView row align="center" gap={8}>
            <LogIn size={16} strokeWidth={2.2} color={tokens.onBrand} />
            <AppText weight="semibold" colorName="onBrand">
              Log in
            </AppText>
          </AppView>
        </AppButton>
      </AppView>

      {/* Settings row — same depth + radius as the welcome card above */}
      <AppPressableView
        rounded={16}
        androidRipple
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        onPress={handleSettings}
        style={{
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
          ...CARD_ELEVATION,
        }}
      >
        <AppView row align="center" gap={14} px={18} py={16}>
          <AppView
            center
            rounded={8}
            style={{ width: 36, height: 36, backgroundColor: tokens.backgroundSecondary }}
          >
            <Settings size={18} strokeWidth={2.1} color={tokens.icon} />
          </AppView>
          <AppView gap={2} style={{ flex: 1 }}>
            <AppText textVariant="body" family="heading" weight="semibold" colorName="text">
              Settings
            </AppText>
            <AppText textVariant="bodyXs" colorName="gray400">
              Theme, notifications, privacy
            </AppText>
          </AppView>
          <ChevronRight size={18} strokeWidth={2.2} color={tokens.gray400} />
        </AppView>
      </AppPressableView>
    </AppView>
  );
}
