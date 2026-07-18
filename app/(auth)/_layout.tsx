import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

export default function AuthStackLayout() {
  const { tokens } = useThemeContext();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.background },
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
    </Stack>
  );
}
