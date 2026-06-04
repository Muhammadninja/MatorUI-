import { router } from 'expo-router';
import {
  ArrowLeft,
  Fingerprint,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  Moon,
  ShieldCheck,
} from 'lucide-react-native';

import ProfileSectionCard from '@/components/screens-components/profile-section-card';
import ScreenShell from '@/components/screens-components/screen-shell';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';

export default function SettingsSecurityScreen() {
  const { tokens, scheme, setScheme } = useThemeContext();
  const { profile } = useUserContext();
  const isDark = scheme === 'dark';

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

          {/* Account */}
          <ProfileSectionCard
            title="Account"
            items={[
              {
                key: 'change-email',
                title: 'Change Email',
                leading: iconBox(Mail),
                rightText: profile?.email ?? '',
                rightChevron: true,
                titleColorName: 'text',
              },
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

          {/* Security */}
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
              {
                key: '2fa',
                title: 'Two-Factor Auth',
                leading: iconBox(ShieldCheck),
                rightText: 'Off',
                rightChevron: true,
                titleColorName: 'text',
              },
            ]}
          />

          {/* Preferences */}
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

          {/* Danger zone */}
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
              },
            ]}
          />
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
