import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

export default function AuthStackLayout() {
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
      {/* Auth is a single unified phone-OTP bottom sheet presented OVER the
          screen that triggered it (transparent modal so that screen stays
          visible behind the scrim). There is no separate sign-up screen. */}
      <Stack.Screen
        name="sign-in"
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'fade',
          animationDuration: 180,
          gestureEnabled: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="select-language"
        options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
      />
      {/* A legal document opened from the sign-in sheet. Pushed onto THIS
          stack, over the sheet, so Back pops back to the sheet with its state
          intact — see app/(auth)/legal/[type].tsx for why it can't reuse the
          Profile-tab routes. Opaque (inherits `tokens.background`). */}
      <Stack.Screen
        name="legal/[type]"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
