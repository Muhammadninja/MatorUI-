import PasswordlessAuthScreen from '@/components/screens-components/auth/passwordless-auth-screen';

/**
 * Sign In — passwordless: phone (default) or email + a one-time code, wired to
 * `useUserContext().requestOtp` / `verifyOtp`. Reached via the purchase gate
 * (`?gate=1`) or from Profile. See `PasswordlessAuthScreen` for the flow.
 */
export default function MatorSignInScreen() {
  return <PasswordlessAuthScreen mode="sign-in" />;
}
