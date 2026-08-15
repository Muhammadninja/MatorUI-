import { router } from 'expo-router';
import { FileText, Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useLanguageContext } from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import { modalService } from '@/services/global-modal-service/global-modal.service';
import { triggerHaptic } from '@/utils/haptics';

export default function SettingsSecurityScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { languageLabel } = useLanguageContext();
  const { deleteAccount } = useUserContext();
  const toast = useToast();

  const confirmDeleteAccount = () => {
    triggerHaptic('warning');
    modalService.openModal('confirmAction', {
      title: t('settings.deleteAccountConfirmTitle'),
      message: t('settings.deleteAccountConfirmMessage'),
      confirmLabel: t('settings.deleteAccountConfirm'),
      cancelLabel: t('common.cancel'),
      onConfirm: async () => {
        try {
          await deleteAccount();
          toast.info(t('settings.accountDeletedToast'));
          router.replace('/explore');
        } catch {
          // Deletion failed server-side — the user stays signed in.
          toast.danger(t('settings.accountDeleteFailedToast'));
        }
      },
    });
  };

  return (
    <AppView flex={1} colorName="background">
      {/* The app follows the phone's light/dark appearance automatically — there
          is no in-app theme toggle. */}
      <AppSettingsHeader title={t('settings.title')} fallbackHref="/profile" />
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
      >
        <AppView gap={20}>
          {/* ── Preferences ─────────────────────────────────────────────── */}
          <AppView px="lg" gap={8}>
            <SectionLabel>{t('settings.preferences')}</SectionLabel>

            <AppView
              rounded={14}
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.card,
                overflow: 'hidden',
              }}
            >
              {/* Language */}
              <AppPressableView
                androidRipple={false}
                onPress={() => {
                  triggerHaptic('selection');
                  router.push('/select-language');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('settings.language')}
                row
                align="center"
                gap="md"
                px="lg"
                py="md"
              >
                <IconBox Icon={Globe} />
                <AppView style={{ flex: 1 }}>
                  <AppText family="accent" weight="semibold" style={{ fontSize: 14.5, color: tokens.text }}>
                    {t('settings.language')}
                  </AppText>
                </AppView>
                <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
                  {languageLabel}
                </AppText>
                <ChevronRight />
              </AppPressableView>
            </AppView>
          </AppView>

          {/* ── Legal ───────────────────────────────────────────────────── */}
          <AppView px="lg" gap={8}>
            <SectionLabel>{t('settings.legal')}</SectionLabel>

            <AppView
              rounded={14}
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.card,
                overflow: 'hidden',
              }}
            >
              {/* Terms & Conditions */}
              <AppPressableView
                androidRipple={false}
                onPress={() => {
                  triggerHaptic('selection');
                  router.push('/terms');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('settings.terms')}
                row
                align="center"
                gap="md"
                px="lg"
                py="md"
              >
                <IconBox Icon={FileText} />
                <AppView style={{ flex: 1 }}>
                  <AppText family="accent" weight="semibold" style={{ fontSize: 14.5, color: tokens.text }}>
                    {t('settings.terms')}
                  </AppText>
                </AppView>
                <ChevronRight />
              </AppPressableView>
            </AppView>
          </AppView>

          {/* ── Delete account ──────────────────────────────────────────── */}
          <AppView px="lg" style={{ marginTop: 4 }}>
            <AppPressableView
              androidRipple={false}
              onPress={confirmDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel={t('settings.deleteAccount')}
            >
              <AppText
                family="accent"
                weight="bold"
                style={{ fontSize: 14, color: tokens.error, paddingVertical: 8 }}
              >
                {t('settings.deleteAccount')}
              </AppText>
            </AppPressableView>
          </AppView>
        </AppView>
      </AppScrollView>
    </AppView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  const { tokens } = useThemeContext();
  return (
    <AppText
      family="accent"
      weight="bold"
      style={{
        fontSize: 12,
        color: tokens.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.06 * 12,
      }}
    >
      {children}
    </AppText>
  );
}

function IconBox({ Icon }: { Icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }> }) {
  const { tokens } = useThemeContext();
  return (
    <AppView
      center
      rounded={11}
      style={{
        width: 38,
        height: 38,
        backgroundColor: tokens.backgroundSecondary,
        flexShrink: 0,
      }}
    >
      <Icon size={17} strokeWidth={2.1} color={tokens.icon} />
    </AppView>
  );
}

function ChevronRight() {
  const { tokens } = useThemeContext();
  return (
    <AppText style={{ fontSize: 16, color: tokens.textMuted, marginLeft: 2 }}>›</AppText>
  );
}
