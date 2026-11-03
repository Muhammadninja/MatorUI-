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
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import the reset helper from the shim file directly (same module instance the
// `expo-secure-store` test alias resolves to), so both tsc and vitest agree.
import { __resetSecureStore } from '@/tests/__shims__/expo-secure-store';

// In-memory AsyncStorage we can inspect / reset independently of the keychain.
const asyncMem = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (asyncMem.has(k) ? (asyncMem.get(k) as string) : null),
    setItem: vi.fn(async (k: string, v: string) => {
      asyncMem.set(k, v);
    }),
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
  vi.restoreAllMocks();
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

// Unit failure injection only: synthetic sessions, no real credentials or API.
const ROTATED: AuthSession = { accessToken: 'synthetic-new-access', refreshToken: 'synthetic-new-refresh', expiresAt: 1785276060 };

test('failed encrypted update restores the newer complete fallback session', async () => {
  await saveAuthSession(SESSION);
  vi.spyOn(SecureStore, 'setItemAsync').mockRejectedValueOnce(new Error('keychain unavailable'));
  await saveAuthSession(ROTATED);
  expect(await loadAuthSession()).toEqual(ROTATED);
});

test('failed fallback update restores the newer atomic encrypted session', async () => {
  await saveAuthSession(SESSION);
  vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage unavailable'));
  await saveAuthSession(ROTATED);
  expect(await loadAuthSession()).toEqual(ROTATED);
});

test('legacy fallback beats split keys that may contain tokens from different rotations', async () => {
  await SecureStore.setItemAsync('auth_v2_access', ROTATED.accessToken);
  await SecureStore.setItemAsync('auth_v2_refresh', SESSION.refreshToken);
  asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION }));
  expect(await loadAuthSession()).toEqual(SESSION);
  await saveAuthSession(ROTATED);
  expect(await SecureStore.getItemAsync('auth_v2_access')).toBeNull();
  expect(await SecureStore.getItemAsync('auth_v2_refresh')).toBeNull();
  expect(await loadAuthSession()).toEqual(ROTATED);
});

test('legacy encrypted-only sessions remain readable and migrate on the next save', async () => {
  await SecureStore.setItemAsync('auth_v2_access', SESSION.accessToken);
  await SecureStore.setItemAsync('auth_v2_refresh', SESSION.refreshToken);
  await SecureStore.setItemAsync('auth_v2_meta', JSON.stringify({ v: 1, expiresAt: SESSION.expiresAt }));
  expect(await loadAuthSession()).toEqual(SESSION);
  await saveAuthSession(ROTATED);
  asyncMem.clear();
  expect(await loadAuthSession()).toEqual(ROTATED);
});

test('clear removes both atomic and legacy encrypted keys', async () => {
  await saveAuthSession(SESSION);
  for (const key of ['auth_v2_access', 'auth_v2_refresh', 'auth_v2_meta']) await SecureStore.setItemAsync(key, 'synthetic-legacy');
  await clearAuthSession();
  for (const key of ['auth_v3_session', 'auth_v2_access', 'auth_v2_refresh', 'auth_v2_meta']) expect(await SecureStore.getItemAsync(key)).toBeNull();
  expect(asyncMem.size).toBe(0);
  expect(await loadAuthSession()).toBeNull();
});

test('clear waits for a pending save so its late encrypted write cannot resurrect a session', async () => {
  const original = SecureStore.setItemAsync;
  let release!: () => void;
  let started!: () => void;
  const reachedWrite = new Promise<void>((resolve) => { started = resolve; });
  vi.spyOn(SecureStore, 'setItemAsync').mockImplementationOnce(async (key, value) => {
    started();
    await new Promise<void>((resolve) => { release = resolve; });
    await original(key, value);
  });
  const save = saveAuthSession(SESSION);
  await reachedWrite;
  const clear = clearAuthSession();
  release();
  await Promise.all([save, clear]);
  expect(await loadAuthSession()).toBeNull();
  expect(asyncMem.size).toBe(0);
});

test('overlapping saves keep the final complete pair in both stores', async () => {
  await Promise.all([saveAuthSession(SESSION), saveAuthSession(ROTATED)]);
  expect(await loadAuthSession()).toEqual(ROTATED);
  asyncMem.clear();
  expect(await loadAuthSession()).toEqual(ROTATED);
});


test.each([
  ['writtenAt', 'writtenAt'],
  ['revision', 'writtenAt'],
  ['writtenAt', 'revision'],
] as const)('newer fallback wins across %s encrypted and %s fallback metadata', async (secureField, fallbackField) => {
  await SecureStore.setItemAsync('auth_v3_session', JSON.stringify({ v: 1, ...SESSION, [secureField]: 100 }));
  asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...ROTATED, [fallbackField]: 200 }));
  expect(await loadAuthSession()).toEqual(ROTATED);
});

test.each([
  ['writtenAt', 'writtenAt'],
  ['revision', 'writtenAt'],
  ['writtenAt', 'revision'],
] as const)('newer encrypted copy wins across %s encrypted and %s fallback metadata', async (secureField, fallbackField) => {
  await SecureStore.setItemAsync('auth_v3_session', JSON.stringify({ v: 1, ...ROTATED, [secureField]: 200 }));
  asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION, [fallbackField]: 100 }));
  expect(await loadAuthSession()).toEqual(ROTATED);
});

test('equal cross-format timestamps prefer the encrypted complete copy', async () => {
  await SecureStore.setItemAsync('auth_v3_session', JSON.stringify({ v: 1, ...ROTATED, writtenAt: 200 }));
  asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION, revision: 200 }));
  expect(await loadAuthSession()).toEqual(ROTATED);
});

test('valid writtenAt recovers an envelope with invalid revision metadata', async () => {
  await SecureStore.setItemAsync('auth_v3_session', JSON.stringify({ v: 1, ...ROTATED, revision: -1, writtenAt: 200 }));
  asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION, revision: 100 }));
  expect(await loadAuthSession()).toEqual(ROTATED);
});

test('new saves emit equal revision and writtenAt fields newer than stored metadata', async () => {
  const prior = Date.now() + 60_000;
  await SecureStore.setItemAsync('auth_v3_session', JSON.stringify({ v: 1, ...SESSION, writtenAt: prior }));
  await saveAuthSession(ROTATED);
  const raw = await SecureStore.getItemAsync('auth_v3_session');
  const metadata = JSON.parse(raw!) as { revision: number; writtenAt: number };
  expect(metadata.revision).toBeGreaterThan(prior);
  expect(metadata.writtenAt).toBe(metadata.revision);
  expect(asyncMem.get('auth:v2:session')).toBe(raw);
});
