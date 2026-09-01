import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

// Anchor the stack to its root screen. Without this, expo-router can treat a
// pushed sub-screen (e.g. shipping-addresses) as the stack root, so `back`
// exits the whole tab to the tabs' initial route (Explore/home) instead of
// returning to `profile` — and the tab keeps the stale pushed screen when
// re-selected. The anchor makes `profile` the guaranteed base of the stack.
export const unstable_settings = { initialRouteName: 'profile' };

export default function ProfileStackLayout() {
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
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      {/* Every sub-screen is a horizontal push off the profile root, so they
          share the same slide-from-right + swipe-back transition used across
          the rest of the app (vehicle-detail, notifications, catalog, …). */}
      <Stack.Screen
        name="edit-profile"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      {/* order-history + liked moved to the ROOT stack (app/order-history.tsx,
          app/liked.tsx) — both Profile and Garage push them, and a root
          location keeps `back` returning to the origin tab (see track-order). */}
      <Stack.Screen
        name="payment-methods"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="shipping-addresses"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="settings-security"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      {/* Legal documents — one route per backend document type. Content is
          fetched from /v1/legal/documents; `terms` keeps its original path so
          existing deep links still resolve. */}
      <Stack.Screen
        name="terms"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="privacy"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="personal-data-consent"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
    </Stack>
  );
}
