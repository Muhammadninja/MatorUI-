import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

// Anchor the stack to its root so `back` from checkout / order-confirmation
// returns to `cart`, never dropping the tab or leaving a stale screen.
export const unstable_settings = { initialRouteName: 'cart' };

export default function CartStackLayout() {
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
      <Stack.Screen name="cart" options={{ headerShown: false }} />
      <Stack.Screen
        name="checkout"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen
        name="order-confirmation"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
    </Stack>
  );
}
