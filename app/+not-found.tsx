import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('nav.notFound') }} />
      <AppView flex={1} colorName="background" center px="xl" gap="lg" safeArea="all">
        <AppText textVariant="title" family="heading" colorName="text">
          {t('nav.pageNotFound')}
        </AppText>
        <AppText textVariant="body" colorName="gray400">
          {t('nav.notFoundBody')}
        </AppText>
        <AppButton title={t('nav.backToExplore')} kind="brand" onPress={() => router.dismissTo('/explore')} />
      </AppView>
    </>
  );
}
