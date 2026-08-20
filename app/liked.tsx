import { Stack } from 'expo-router';

import LikedScreen from '@/components/screens/liked-screen';

/**
 * Liked/saved parts is mounted on the ROOT stack (above the tab
 * navigator) because it's pushed from more than one tab — Profile *and*
 * Garage ("Saved parts" quick action). Hosting it inside the profile tab
 * stack means a push from Garage switches tabs and `back` lands on
 * Profile instead of Garage. The root location keeps `router.back()`
 * honest from any entry point (same reasoning as track-order).
 */
export default function LikedRoute() {
  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <LikedScreen />
    </>
  );
}
