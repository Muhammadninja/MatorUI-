import { Stack } from 'expo-router';

import RecentlyViewedScreen from '@/components/screens/recently-viewed-screen';

export default function RecentlyViewedRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <RecentlyViewedScreen />
    </>
  );
}
