import { Stack } from 'expo-router';

import TopFeaturedScreen from '@/components/screens/top-featured-screen';

export default function TopFeaturedRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TopFeaturedScreen />
    </>
  );
}
