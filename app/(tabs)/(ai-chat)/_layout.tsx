import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

export default function AiChatStackLayout() {
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
      <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
    </Stack>
  );
}
