import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

// Anchor the stack to its root so `back` from add-vehicle / vehicle-detail
// returns to `garage`, never dropping the tab or leaving a stale screen.
export const unstable_settings = { initialRouteName: 'garage' };

export default function GarageStackLayout() {
  const { tokens } = useThemeContext();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.background },
        // Edge-only swipe-back (see root layout) — not full-screen.
        fullScreenGestureEnabled: false,
        gestureResponseDistance: { start: 50 },
      }}
    >
      <Stack.Screen name="garage" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-vehicle"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="vehicle-detail"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
