import { Stack } from 'expo-router';

import TrackOrderScreen from '@/components/screens/track-order-screen';

export default function TrackOrderRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TrackOrderScreen />
    </>
  );
}
