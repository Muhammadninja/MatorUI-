import { router } from 'expo-router';
import {
  Fingerprint,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  Moon,
} from 'lucide-react-native';
import { useState } from 'react';

import LanguagePickerSheet from '@/components/screens-components/language-picker-sheet/language-picker-sheet';
import ProfileSectionCard from '@/components/screens-components/profile/profile-section-card';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppView } from '@/components/shared/app-view';
import { useLanguageContext } from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useGlobalModal } from '@/hooks/use-global-modal';
import { triggerHaptic } from '@/utils/haptics';

export default function SettingsSecurityScreen() {
  const { tokens, scheme, setScheme } = useThemeContext();
  const { profile, isAuthenticated, signOut } = useUserContext();
  const { openConfirm } = useGlobalModal();
  const { languageLabel } = useLanguageContext();
  const isDark = scheme === 'dark';
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);

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
        rounded={8}
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
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Settings" fallbackHref="/profile" />
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
      >
        <AppView gap={20}>
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
                    },
                  ]
                : []),
              {
                key: 'language',
                title: 'Language',
                leading: iconBox(Globe),
                rightText: languageLabel,
                rightChevron: true,
                onPress: () => {
                  triggerHaptic('selection');
                  setLanguageSheetOpen(true);
                },
              },
            ]}
          />

          {isAuthenticated ? (
            <ProfileSectionCard
              title="Security"
              items={[
                {
                  key: 'password',
                  title: 'Change Password',
                  leading: iconBox(KeyRound),
                  rightChevron: true,
                },
                {
                  key: 'biometrics',
                  title: 'Biometric Login',
                  leading: iconBox(Fingerprint),
                  rightChevron: true,
                },
              ]}
            />
          ) : null}

          <ProfileSectionCard
            title="Preferences"
            items={[
              {
                key: 'dark-mode',
                title: 'Dark Mode',
                leading: iconBox(Moon),
                rightSwitchValue: isDark,
                onRightSwitchChange: (v) => setScheme(v ? 'dark' : 'light'),
              },
            ]}
          />

          {isAuthenticated ? (
            <ProfileSectionCard
              title="Account Actions"
              items={[
                {
                  key: 'sign-out',
                  title: 'Sign Out',
                  leading: iconBox(LogOut, true),
                  rightChevron: true,
                  titleStyle: { color: tokens.error },
                  onPress: handleSignOut,
                },
              ]}
            />
          ) : null}
        </AppView>
      </AppScrollView>

      <LanguagePickerSheet
        visible={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
      />
    </AppView>
  );
}
