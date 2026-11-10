import { Stack } from 'expo-router';

import SelectLanguageScreen from '@/components/screens/select-language-screen';
import { useE2EStartupMount } from '@/hooks/use-e2e-startup-mount';

export default function SelectLanguageRoute() {
  useE2EStartupMount('language-route');
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <SelectLanguageScreen />
    </>
  );
}
