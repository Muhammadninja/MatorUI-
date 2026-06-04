import { useEffect, useState } from 'react';

export function useLoadingDelay(loading?: boolean, delayMs?: number) {
  const [show, setShow] = useState<boolean>(!!loading && !(delayMs && delayMs > 0));
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (loading) {
      if (delayMs && delayMs > 0) {
        t = setTimeout(() => setShow(true), delayMs);
      } else {
        setShow(true);
      }
    } else {
      setShow(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [loading, delayMs]);
  return show;
}
