import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

export default function AiChatStackLayout() {
  const { tokens } = useThemeContext();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.background },
      }}
    >
      <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
    </Stack>
  );
}
