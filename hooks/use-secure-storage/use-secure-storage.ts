import * as SecureStore from 'expo-secure-store';
import { useCallback } from 'react';

/**
 * Thin async wrapper around expo-secure-store for credentials / tokens
 * that must NOT live in AsyncStorage. Internally caches no value — the
 * caller decides whether to keep it in React state.
 *
 * Use this for: auth access/refresh tokens, OAuth state, biometric-
 * encrypted secrets, payment-method handles.
 *
 * Use AsyncStorage for: cart, search history, UI preferences.
 */

export type UseSecureStorageValue = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<boolean>;
  remove: (key: string) => Promise<boolean>;
  /** Convenience: write or clear in one call based on whether `value` is null. */
  upsert: (key: string, value: string | null) => Promise<boolean>;
};

export function useSecureStorage(): UseSecureStorageValue {
  const get = useCallback(async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  }, []);

  const set = useCallback(async (key: string, value: string): Promise<boolean> => {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const remove = useCallback(async (key: string): Promise<boolean> => {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch {
      return false;
    }
  }, []);

  const upsert = useCallback(
    async (key: string, value: string | null) => {
      if (value === null) return remove(key);
      return set(key, value);
    },
    [remove, set],
  );

  return { get, set, remove, upsert };
}

export default useSecureStorage;
