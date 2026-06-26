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
      <Stack.Screen
        name="sign-in"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          animationDuration: 180,
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen
        name="sign-up"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          animationDuration: 180,
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen
        name="select-language"
        options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
      />
    </Stack>
  );
}
