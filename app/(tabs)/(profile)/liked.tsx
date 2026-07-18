import { Stack } from 'expo-router';

import LikedScreen from '@/components/screens/liked-screen';

export default function LikedRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LikedScreen />
    </>
  );
}
