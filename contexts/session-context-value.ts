import { useCallback, useMemo, useRef, useState } from 'react';

/** A keyed state controller can reset without unmounting the context's screens. */
export function useSessionContextValue<T>(key: string, empty: T) {
  const session = useMemo(() => ({ key }), [key]);
  const active = useRef(session);
  active.current = session;
  const [snapshot, setSnapshot] = useState<{ session: typeof session; value: T }>();
  const publish = useCallback(
    (value: T) => {
      // A -> B -> A must also reject publications from the *first* A instance.
      if (active.current !== session) return;
      setSnapshot((previous) => {
        if (active.current !== session) return previous;
        return previous?.session === session && previous.value === value ? previous : { session, value };
      });
    },
    [session],
  );
  return [snapshot?.session === session ? snapshot.value : empty, publish] as const;
}
