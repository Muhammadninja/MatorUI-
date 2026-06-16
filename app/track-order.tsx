import { Stack } from 'expo-router';

import TrackOrderScreen from '@/components/screens/track-order-screen';

/**
 * Track-order is mounted on the ROOT stack (above the tab navigator)
 * because four surfaces push to it — cart screen, order-confirmation,
 * order-history (under profile), and the AI-chat deep-link. Hosting it
 * inside a tab stack means the back action returns to that tab's root,
 * not the actual previous screen across tabs. The root location keeps
 * the navigation history honest from any entry point.
 */
export default function TrackOrderRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <TrackOrderScreen />
    </>
  );
}
