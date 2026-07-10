import { router, Stack } from 'expo-router';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export default function ModalScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <AppView flex={1} colorName="background" center px="xl" gap="lg" safeArea="all">
        <AppText textVariant="title" family="heading" colorName="text">
          Mator
        </AppText>
        <AppText textVariant="body" colorName="gray400">
          Swipe down to dismiss.
        </AppText>
        <AppButton title="Close" kind="secondary" onPress={() => router.back()} />
      </AppView>
    </>
  );
}
