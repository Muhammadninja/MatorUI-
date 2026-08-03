/**
 * Regression tests for the auth-session persistence that caused "re-login on
 * every launch". Locks in all three failure modes that were fixed:
 *   1. SecureStore keys must be legal (a ':' threw "Invalid key" → silent write
 *      failure). The test shim now enforces the real rule, and the
 *      "SecureStore alone persists" case fails if an illegal key is reintroduced.
 *   2. AsyncStorage is a reliable fallback when the keychain drops the value.
 *   3. save → load round-trips; clear wipes both stores.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
// Import the reset helper from the shim file directly (same module instance the
// `expo-secure-store` test alias resolves to), so both tsc and vitest agree.
import { __resetSecureStore } from '@/tests/__shims__/expo-secure-store';

// In-memory AsyncStorage we can inspect / reset independently of the keychain.
const asyncMem = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (asyncMem.has(k) ? (asyncMem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      asyncMem.set(k, v);
    },
    removeItem: async (k: string) => {
      asyncMem.delete(k);
    },
  },
}));

import {
  saveAuthSession,
  loadAuthSession,
  clearAuthSession,
  type AuthSession,
} from './auth-storage';

const SESSION: AuthSession = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  expiresAt: 1785275960,
};

beforeEach(() => {
  __resetSecureStore();
  asyncMem.clear();
});

describe('auth-storage persistence (re-login regression)', () => {
  test('round-trips a session through save → load', async () => {
    await saveAuthSession(SESSION);
    expect(await loadAuthSession()).toEqual(SESSION);
  });

  test('SecureStore alone persists it — guards against illegal keys (e.g. a colon)', async () => {
    await saveAuthSession(SESSION);
    // Wipe ONLY the AsyncStorage copy → the keychain must hold it. If the
    // SecureStore keys were illegal, the write would have thrown and nothing
    // would be stored, so this would return null and fail — catching the exact
    // bug (colon in the key) that silently broke persistence.
    asyncMem.clear();
    expect(await loadAuthSession()).toEqual(SESSION);
  });

  test('AsyncStorage is the fallback when the keychain loses the value', async () => {
    await saveAuthSession(SESSION);
    __resetSecureStore(); // the real iOS-release failure mode
    expect(await loadAuthSession()).toEqual(SESSION);
  });

  test('clear() removes the session from both stores', async () => {
    await saveAuthSession(SESSION);
    await clearAuthSession();
    expect(await loadAuthSession()).toBeNull();
    expect(asyncMem.size).toBe(0);
  });

  test('no persisted session → null', async () => {
    expect(await loadAuthSession()).toBeNull();
  });
});
