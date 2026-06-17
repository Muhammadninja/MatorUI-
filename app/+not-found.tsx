import { router, Stack } from 'expo-router';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <AppView flex={1} colorName="background" center px="xl" gap="lg" safeArea="all">
        <AppText textVariant="title" family="heading" colorName="text">
          Page not found
        </AppText>
        <AppText textVariant="body" colorName="gray400">
          We could not find that page.
        </AppText>
        <AppButton title="Back to Explore" kind="brand" onPress={() => router.replace('/explore')} />
      </AppView>
    </>
  );
}
