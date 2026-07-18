import { Stack } from 'expo-router';

import PasswordlessAuthScreen from '@/components/screens-components/auth/passwordless-auth-screen';

/**
 * Auth route — a single unified phone-OTP bottom sheet (there is no separate
 * "sign up" screen; new and returning numbers use the same flow). Presented as a
 * `transparentModal` over whatever triggered it (see `app/(auth)/_layout.tsx`).
 */
export default function SignInRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PasswordlessAuthScreen />
    </>
  );
}
