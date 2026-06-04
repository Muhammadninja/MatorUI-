import { Stack } from 'expo-router';

import NotificationsScreen from '@/components/screens/notifications-screen';

export default function NotificationsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NotificationsScreen />
    </>
  );
}
