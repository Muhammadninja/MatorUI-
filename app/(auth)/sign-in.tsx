import { Stack } from 'expo-router';

import AuthScreen from '@/components/screens/auth-screen';

export default function SignInRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthScreen mode="login" />
    </>
  );
}
