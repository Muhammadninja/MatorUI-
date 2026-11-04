import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Holds a sourcing request while a guest signs in, then sends it once. It only
 * sends if this guest asked to from the prompt: signing in some other way, or
 * dismissing the sheet and signing in later, leaves the request for them to send.
 */
export function useSourcingSignInGate({
  isAuthenticated,
  submit,
}: {
  isAuthenticated: boolean;
  submit: (assistantMessageId: string) => void;
}) {
  const waitingFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !waitingFor.current) return;
    const id = waitingFor.current;
    waitingFor.current = null;
    submit(id);
  }, [isAuthenticated, submit]);

  // Back on this screen still signed out means the sheet was dismissed.
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) waitingFor.current = null;
    }, [isAuthenticated]),
  );

  return useCallback(
    (assistantMessageId: string) => {
      if (isAuthenticated) {
        submit(assistantMessageId);
        return;
      }
      waitingFor.current = assistantMessageId;
      router.push('/sign-in?gate=1');
    },
    [isAuthenticated, submit],
  );
}
