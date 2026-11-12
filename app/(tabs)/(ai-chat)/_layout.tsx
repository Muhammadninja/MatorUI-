import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

// Anchor the stack to its root screen for consistent back behavior.
export const unstable_settings = { initialRouteName: 'ai-chat' };

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
      <Stack.Screen
        name="chat-item/[id]"
        options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}
      />
    </Stack>
  );
}
