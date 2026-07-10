import { Stack } from 'expo-router';

import MatorSignUpScreen from '@/components/screens/mator-sign-up-screen';

export default function SignUpRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MatorSignUpScreen />
    </>
  );
}
