import { useEffect, useRef } from 'react';

import { SmsUserConsent } from '@/modules/sms-user-consent';

/**
 * While `listenKey` is non-null, listen for the next OTP SMS through Android's
 * SMS User Consent prompt and hand its text to `onMessage`. A new key (a resent
 * code) restarts the five-minute window; null stops it. A no-op on iOS, where
 * the keyboard offers the code, and on binaries without the native module.
 */
export function useSmsUserConsent(
  listenKey: string | null,
  onMessage: (message: string) => void,
  native = SmsUserConsent,
): void {
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!listenKey || !native) return;
    const subscription = native.addListener('onSmsConsent', (event) => {
      if (event.status === 'received') handler.current(event.message);
    });
    try {
      native.start();
    } catch {
      // Play services missing or busy: typing and the keyboard still work.
    }
    return () => {
      subscription.remove();
      try {
        native.stop();
      } catch {
        // Nothing to stop.
      }
    };
  }, [listenKey, native]);
}
