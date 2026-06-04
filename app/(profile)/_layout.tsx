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
    />
  );
}
