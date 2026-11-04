import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Holds a sourcing request while a guest signs in, then sends it once. The request
 * travels in here because signing in clears the guest's conversation: this is the
 * only thing that crosses over. It only sends if this guest asked to from the
 * prompt: signing in some other way, or dismissing the sheet and signing in later,
 * sends nothing. `ready` holds it until the account's chat and vehicle have loaded.
 */
export function useSourcingSignInGate<THeld>({
  isAuthenticated,
  ready,
  submit,
}: {
  isAuthenticated: boolean;
  ready: boolean;
  submit: (held: THeld) => void;
}) {
  const waiting = useRef<{ held: THeld } | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !ready || !waiting.current) return;
    const { held } = waiting.current;
    waiting.current = null;
    submit(held);
  }, [isAuthenticated, ready, submit]);

  // Back on this screen still signed out means the sheet was dismissed.
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) waiting.current = null;
    }, [isAuthenticated]),
  );

  return useCallback(
    (held: THeld) => {
      if (isAuthenticated) {
        submit(held);
        return;
      }
      waiting.current = { held };
      router.push('/sign-in?gate=1');
    },
    [isAuthenticated, submit],
  );
}
