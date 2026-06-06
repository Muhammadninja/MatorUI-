import { router } from 'expo-router';
import { ChevronRight, LogIn, Settings, UserRound } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useGlobalModal } from '@/hooks/use-global-modal';
import { triggerHaptic } from '@/utils/haptics';

export default function ProfileGuestEmpty() {
  const { tokens, scheme } = useThemeContext();
  const { guestId } = useUserContext();
  const { openAuthRequired } = useGlobalModal();
  const isDark = scheme === 'dark';

  const handleSettings = () => {
    triggerHaptic('selection');
    router.push('/settings-security');
  };

  const handleLogin = () => {
    triggerHaptic('selection');
    // Show the Log in / Sign up modal. Each button routes to /sign-in or
    // /sign-up; the auth screen lands the user on /profile via the `next`
    // param so they end up back here after a successful sign-in.
    openAuthRequired({
      title: 'Welcome to Matorui',
      message:
        'Log in to access your garage and orders, or create an account to get started.',
      redirectTo: '/profile',
    });
  };

  return (
    <AppView px={20} pt={28} gap={20}>
      {/* Guest ID card — layered shadow for a soft 3D lift */}
      <View
        style={[
          styles.cardOuter,
          {
            backgroundColor: tokens.card,
            borderColor: isDark ? `${tokens.border}80` : tokens.border,
            ...Platform.select({
              ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 18 },
                shadowOpacity: isDark ? 0.45 : 0.12,
                shadowRadius: 28,
              },
              android: { elevation: 16 },
            }),
          },
        ]}
      >
        {/* Inner highlight rim — fakes a top light source for the 3D feel */}
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(255,255,255,0.6)',
            },
          ]}
        />

        <AppView align="center" gap={16} py={28} px={20}>
          {/* Avatar pedestal */}
          <View
            style={[
              styles.avatarPedestal,
              {
                backgroundColor: tokens.backgroundSecondary,
                borderColor: isDark ? `${tokens.border}60` : tokens.border,
                ...Platform.select({
                  ios: {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: isDark ? 0.5 : 0.14,
                    shadowRadius: 12,
                  },
                  android: { elevation: 8 },
                }),
              },
            ]}
          >
            <UserRound size={36} strokeWidth={1.6} color={tokens.gray400} />
          </View>

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
      </View>

      {/* Settings row — same depth language, slightly softer */}
      <Pressable
        onPress={handleSettings}
        android_ripple={{ color: `${tokens.text}10`, borderless: false }}
        style={({ pressed }) => [
          styles.settingsRow,
          {
            backgroundColor: tokens.card,
            borderColor: isDark ? `${tokens.border}80` : tokens.border,
            ...Platform.select({
              ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: isDark ? 0.4 : 0.1,
                shadowRadius: 18,
              },
              android: { elevation: 10 },
            }),
            transform: [{ scale: pressed ? 0.985 : 1 }],
            opacity: pressed ? 0.95 : 1,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(255,255,255,0.5)',
            },
          ]}
        />
        <AppView row align="center" gap={14} px={18} py={16}>
          <View
            style={[
              styles.settingsIconBox,
              { backgroundColor: tokens.backgroundSecondary },
            ]}
          >
            <Settings size={18} strokeWidth={2.1} color={tokens.icon} />
          </View>
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
      </Pressable>
    </AppView>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  avatarPedestal: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRow: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
