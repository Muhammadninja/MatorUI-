import { Stack } from 'expo-router';

import AuthScreen from '@/components/screens/auth-screen';

export default function SignUpRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthScreen mode="signup" />
    </>
  );
}
