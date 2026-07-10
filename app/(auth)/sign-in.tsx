import { Stack } from 'expo-router';

import MatorSignInScreen from '@/components/screens/mator-sign-in-screen';

export default function SignInRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MatorSignInScreen />
    </>
  );
}
