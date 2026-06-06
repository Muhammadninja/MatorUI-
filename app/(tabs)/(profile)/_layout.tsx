import { Stack } from 'expo-router';

import { useThemeContext } from '@/contexts/theme.context';

export default function ProfileStackLayout() {
  const { tokens } = useThemeContext();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.background },
      }}
    >
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="order-history" options={{ headerShown: false }} />
      <Stack.Screen name="payment-methods" options={{ headerShown: false }} />
      <Stack.Screen name="recently-viewed" options={{ headerShown: false }} />
      <Stack.Screen name="shipping-addresses" options={{ headerShown: false }} />
      <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
      <Stack.Screen name="settings-security" options={{ headerShown: false }} />
    </Stack>
  );
}
