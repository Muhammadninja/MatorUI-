import PasswordlessAuthScreen from '@/components/screens-components/auth/passwordless-auth-screen';

/**
 * Sign Up — passwordless: name + phone (default) or email + a one-time code,
 * wired to `useUserContext().requestOtp` / `verifyOtp`. See
 * `PasswordlessAuthScreen` for the two-phase (identifier → code) flow.
 */
export default function MatorSignUpScreen() {
  return <PasswordlessAuthScreen mode="sign-up" />;
}
