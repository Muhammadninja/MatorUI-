import { Stack } from 'expo-router';

import PasswordlessAuthScreen from '@/components/screens-components/auth/passwordless-auth-screen';
import { useE2EStartupMount } from '@/hooks/use-e2e-startup-trace';

/**
 * Auth route — a single unified phone-OTP bottom sheet (there is no separate
 * "sign up" screen; new and returning numbers use the same flow). Presented as a
 * `transparentModal` over whatever triggered it (see `app/(auth)/_layout.tsx`).
 */
export default function SignInRoute() {
  useE2EStartupMount('sign-in-route');
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PasswordlessAuthScreen />
    </>
  );
}
