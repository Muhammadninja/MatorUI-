import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

export default function ExploreStackLayout() {
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
      <Stack.Screen name="explore" options={{ headerShown: false }} />
      <Stack.Screen
        name="catalog/index"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="catalog/parts"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="category"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="make"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="vehicle-parts"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="search"
        options={{ headerShown: false, animation: 'fade', gestureEnabled: true }}
      />
      <Stack.Screen
        name="item-detail/[id]"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
