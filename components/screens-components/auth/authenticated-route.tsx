import { router } from 'expo-router';
import { Fragment, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useUserContext } from '@/contexts/user.context';

/** Keep private screens unmounted until restoration resolves to an account.
 * Dismissing phone sign-in returns to this gate; account changes remount the
 * private screen so forms cannot retain the preceding account's local state.
 */
export function AuthenticatedRoute({
  children,
  titleKey,
  fallbackHref,
}: PropsWithChildren<{ titleKey: string; fallbackHref: string }>) {
  const { profile, isAuthenticated, isHydrating } = useUserContext();
  const { t } = useTranslation();

  if (!isHydrating && isAuthenticated && profile) {
    return <Fragment key={profile.id}>{children}</Fragment>;
  }

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title={t(titleKey)}
        fallbackHref={fallbackHref}
        backAccessibilityLabel={t('common.back')}
      />
      <AppView flex={1} center gap={20} px="lg" accessibilityState={{ busy: isHydrating }}>
        {isHydrating ? <WheelLoader /> : (
          <>
            <AppText textVariant="body" align="center">{t('modalHost.signInToContinue')}</AppText>
            <AppButton
              testID="authenticated-route-sign-in"
              title={t('modalHost.continueWithPhone')}
              kind="brand"
              size="lg"
              fullWidth
              onPress={() => router.push('/sign-in')}
            />
          </>
        )}
      </AppView>
    </AppView>
  );
}
