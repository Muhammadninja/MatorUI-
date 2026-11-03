import { router } from 'expo-router';
import { ChevronRight, LogIn, Settings, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

export default function ProfileGuestEmpty() {
  const { tokens } = useThemeContext();
  const { t } = useTranslation();
  const { guestId } = useUserContext();
  const { openAuthRequired } = useGlobalModal();

  const handleSettings = () => {
    triggerHaptic('selection');
    router.push('/settings-security');
  };

  const handleLogin = () => {
    triggerHaptic('selection');
    openAuthRequired({
      title: t('profileCards.welcomeTitle'),
      message: t('profileCards.welcomeMessage'),
      redirectTo: '/profile',
    });
  };

  return (
    <AppView px="lg" pt={28} gap="lg">
      {/* Guest welcome card */}
      <AppView
        rounded={16}
        gap="lg"
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
            backgroundColor: tokens.brandSoft,
            borderWidth: 1,
            borderColor: tokens.border,
          }}
        >
          <UserRound size={40} strokeWidth={1.8} color={tokens.brand} />
        </AppView>

        <AppView align="center" gap={6}>
          <AppText
            textVariant="caption"
            family="accent"
            weight="bold"
            transform="uppercase"
            style={{ color: tokens.textMuted, letterSpacing: 1.4 }}
          >
            {t('profileCards.guestSession')}
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
            colorName="textMuted"
            style={{ textAlign: 'center', maxWidth: 260 }}
          >
            {t('profileCards.guestExplanation')}
          </AppText>
        </AppView>

        <AppButton
          kind="brand"
          size="md"
          fullWidth
          onPress={handleLogin}
          accessibilityLabel={t('profileCards.logInToAccount')}
          containerStyle={{ width: '100%', marginTop: 4 }}
        >
          <AppView row align="center" gap="sm">
            <LogIn size={16} strokeWidth={2.2} color={tokens.onBrand} />
            <AppText weight="bold" colorName="onBrand">
              {t('profileCards.logIn')}
            </AppText>
          </AppView>
        </AppButton>
      </AppView>

      {/* Settings row — same depth + radius as the welcome card above */}
      <AppPressableView
        rounded={16}
        androidRipple
        accessibilityRole="button"
        accessibilityLabel={t('profileCards.openSettings')}
        onPress={handleSettings}
        style={{
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
          ...CARD_ELEVATION,
        }}
      >
        <AppView row align="center" gap={14} px={18} py="lg">
          <AppView
            center
            rounded={8}
            style={{ width: 36, height: 36, backgroundColor: tokens.backgroundSecondary }}
          >
            <Settings size={18} strokeWidth={2.1} color={tokens.icon} />
          </AppView>
          <AppView style={{ flex: 1 }}>
            <AppText textVariant="body" family="heading" weight="bold" colorName="text">
              {t('profileCards.settings')}
            </AppText>
          </AppView>
          <ChevronRight size={18} strokeWidth={2.2} color={tokens.textMuted} />
        </AppView>
      </AppPressableView>
    </AppView>
  );
}
