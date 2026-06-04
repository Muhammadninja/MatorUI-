import { Stack } from 'expo-router';

import SettingsSecurityScreen from '@/components/screens/settings-security-screen';

export default function SettingsSecurityRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsSecurityScreen />
    </>
  );
}
