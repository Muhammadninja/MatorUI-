import { Stack } from 'expo-router';

import NotificationSettingsScreen from '@/components/screens/notification-settings-screen';

export default function NotificationSettingsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NotificationSettingsScreen />
    </>
  );
}
