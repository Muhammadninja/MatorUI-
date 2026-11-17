import { Platform } from 'react-native';

export type SmsConsentEvent =
  | { status: 'received'; message: string }
  | { status: 'timeout' | 'denied' | 'error' };

export type SmsUserConsentNative = {
  start(): boolean;
  stop(): void;
  addListener(
    event: 'onSmsConsent',
    listener: (event: SmsConsentEvent) => void,
  ): { remove(): void };
};

function load(): SmsUserConsentNative | null {
  if (Platform.OS !== 'android') return null;
  // Required lazily so non-Android code paths (and tests) never load expo's runtime.
  const { requireOptionalNativeModule } = require('expo') as typeof import('expo');
  return requireOptionalNativeModule<SmsUserConsentNative>('SmsUserConsent');
}

/**
 * Android SMS User Consent (modules/sms-user-consent). Null on iOS, on web,
 * and on any Android binary built before the module existed — this app ships
 * OTA updates, so JS can run on an older binary and must not assume it.
 */
export const SmsUserConsent: SmsUserConsentNative | null = load();
