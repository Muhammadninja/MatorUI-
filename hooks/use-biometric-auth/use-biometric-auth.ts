import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';

/**
 * FaceID / TouchID / device passcode prompt wrapper.
 *
 * Use to gate: place-order, view-payment-methods, reveal-password-reset
 * token, share-encrypted-receipt, anything financial.
 *
 * Falls back gracefully on unsupported devices — `isSupported` is false
 * and `authenticate()` resolves true so callers don't have to special-
 * case dev simulators.
 */

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'none';

export type AuthenticatePromptOptions = {
  reason?: string;
  fallbackLabel?: string;
  cancelLabel?: string;
  disableDeviceFallback?: boolean;
};

export type UseBiometricAuthValue = {
  isSupported: boolean;
  isEnrolled: boolean;
  kinds: BiometricKind[];
  authenticate: (options?: AuthenticatePromptOptions) => Promise<boolean>;
  refresh: () => Promise<void>;
};

function mapType(t: LocalAuthentication.AuthenticationType): BiometricKind {
  switch (t) {
    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
      return 'face';
    case LocalAuthentication.AuthenticationType.FINGERPRINT:
      return 'fingerprint';
    case LocalAuthentication.AuthenticationType.IRIS:
      return 'iris';
    default:
      return 'none';
  }
}

export function useBiometricAuth(): UseBiometricAuthValue {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [kinds, setKinds] = useState<BiometricKind[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [supported, enrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      setIsSupported(supported);
      setIsEnrolled(enrolled);
      setKinds(types.map(mapType));
    } catch {
      setIsSupported(false);
      setIsEnrolled(false);
      setKinds([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const authenticate = useCallback(
    async (options?: AuthenticatePromptOptions): Promise<boolean> => {
      // Devices without biometric hardware → don't gate the action.
      if (!isSupported || !isEnrolled) return true;
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: options?.reason ?? 'Authenticate to continue',
          fallbackLabel: options?.fallbackLabel,
          cancelLabel: options?.cancelLabel,
          disableDeviceFallback: options?.disableDeviceFallback,
        });
        return result.success;
      } catch {
        return false;
      }
    },
    [isSupported, isEnrolled],
  );

  return { isSupported, isEnrolled, kinds, authenticate, refresh };
}

export default useBiometricAuth;
