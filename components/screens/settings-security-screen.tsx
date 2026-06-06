import { router } from 'expo-router';
import {
  ArrowLeft,
  Fingerprint,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  Moon,
} from 'lucide-react-native';

import ProfileSectionCard from '@/components/screens-components/profile/profile-section-card';
import ScreenShell from '@/components/screens-components/screen-shell';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useGlobalModal } from '@/hooks/use-global-modal';
import { triggerHaptic } from '@/utils/haptics';

export default function SettingsSecurityScreen() {
  const { tokens, scheme, setScheme } = useThemeContext();
  const { profile, isAuthenticated, signOut } = useUserContext();
  const { openConfirm } = useGlobalModal();
  const isDark = scheme === 'dark';

  const handleSignOut = () => {
    openConfirm({
      title: 'Sign out?',
      message: 'You can sign back in anytime. Your cart will stay saved on this device.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Cancel',
      onConfirm: () => {
        triggerHaptic('warning');
        signOut();
        router.replace('/profile');
      },
    });
  };

  function iconBox(
    Icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>,
    danger = false,
  ) {
    return (
      <AppView
        center
        rounded={12}
        style={{
          width: 34,
          height: 34,
          backgroundColor: danger ? `${tokens.error}18` : tokens.backgroundSecondary,
        }}
      >
        <Icon size={16} strokeWidth={2.1} color={danger ? tokens.error : tokens.icon} />
      </AppView>
    );
  }

  return (
    <ScreenShell>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <AppView mt={14} gap={24}>
          {/* Header */}
          <AppView px={16} gap={14}>
            <AppView row align="center">
              <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
                <AppPressableView
                  row
                  align="center"
                  androidRipple={false}
                  onPress={() => router.back()}
                >
                  <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
                </AppPressableView>
              </AppView>

              <AppText
                textVariant="title"
                family="heading"
                weight="bold"
                style={{ textAlign: 'center' }}
              >
                Settings
              </AppText>

              <AppView style={{ flex: 1 }} />
            </AppView>
          </AppView>

          {/* Account — partially hidden for guests (only Language is universal) */}
          <ProfileSectionCard
            title="Account"
            items={[
              ...(isAuthenticated
                ? [
                    {
                      key: 'change-email',
                      title: 'Change Email',
                      leading: iconBox(Mail),
                      rightText: profile?.email ?? '',
                      rightChevron: true,
                      titleColorName: 'text' as const,
                    },
                  ]
                : []),
              {
                key: 'language',
                title: 'Language',
                leading: iconBox(Globe),
                rightText: 'English',
                rightChevron: true,
                titleColorName: 'text',
              },
            ]}
          />

          {/* Security — entirely hidden for guests; nothing here works without an account */}
          {isAuthenticated ? (
            <ProfileSectionCard
              title="Security"
              items={[
                {
                  key: 'password',
                  title: 'Change Password',
                  leading: iconBox(KeyRound),
                  rightChevron: true,
                  titleColorName: 'text',
                },
                {
                  key: 'biometrics',
                  title: 'Biometric Login',
                  leading: iconBox(Fingerprint),
                  rightChevron: true,
                  titleColorName: 'text',
                },
              ]}
            />
          ) : null}

          {/* Preferences — works for everyone */}
          <ProfileSectionCard
            title="Preferences"
            items={[
              {
                key: 'dark-mode',
                title: 'Dark Mode',
                leading: iconBox(Moon),
                rightSwitchValue: isDark,
                onRightSwitchChange: (v) => setScheme(v ? 'dark' : 'light'),
                titleColorName: 'text',
              },
            ]}
          />

          {/* Account Actions — only meaningful when signed in */}
          {isAuthenticated ? (
            <ProfileSectionCard
              title="Account Actions"
              items={[
                {
                  key: 'sign-out',
                  title: 'Sign Out',
                  leading: iconBox(LogOut, true),
                  titleColorName: 'text',
                  rightChevron: true,
                  titleStyle: { color: tokens.error },
                  onPress: handleSignOut,
                },
              ]}
            />
          ) : null}
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
