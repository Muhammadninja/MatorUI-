import { Stack } from 'expo-router';

import SelectLanguageScreen from '@/components/screens/select-language-screen';

export default function SelectLanguageRoute() {
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
