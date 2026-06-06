import { useCallback, useRef } from 'react';

import { useUserContext } from '@/contexts/user.context';
import { useGlobalModal } from '@/hooks/use-global-modal';

export type AuthGuardOptions = {
  /** Modal title shown when access is denied. */
  title?: string;
  /** Modal body copy explaining why login is needed. */
  message?: string;
  /** Called when the user dismisses the auth prompt without signing in. */
  onCancel?: () => void;
  /** URL the auth screen should replace to after a successful sign-in. */
  redirectTo?: string;
};

export type RequireAuth = <TArgs extends unknown[]>(
  action: (...args: TArgs) => void,
  options?: AuthGuardOptions,
) => (...args: TArgs) => void;

/**
 * Hook returning a `requireAuth` HOF. Wrap any action that needs an
 * authenticated user — guests are intercepted with the auth-required modal,
 * and the original action is replayed once they sign in.
 *
 * The returned `requireAuth` and `isAuthenticated` flag are referentially
 * stable across renders so they can be passed to memoized children without
 * triggering re-renders.
 *
 * @example
 *   const { requireAuth } = useAuthGuard();
 *   const handleCheckout = requireAuth(() => router.push('/checkout'), {
 *     message: 'Sign in to place an order.',
 *   });
 */
export function useAuthGuard() {
  const { isAuthenticated } = useUserContext();
  const { openAuthRequired } = useGlobalModal();

  // Keep latest value reachable from the stable callback without re-creating it.
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  const requireAuth = useCallback<RequireAuth>(
    (action, options) => {
      return (...args) => {
        if (isAuthenticatedRef.current) {
          action(...args);
          return;
        }
        openAuthRequired({
          title: options?.title,
          message: options?.message,
          onCancel: options?.onCancel,
          redirectTo: options?.redirectTo,
          onAuthenticated: () => action(...args),
        });
      };
    },
    [openAuthRequired],
  );

  return {
    isAuthenticated,
    requireAuth,
  };
}

export default useAuthGuard;
