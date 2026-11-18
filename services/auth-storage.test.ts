/**
 * Regression tests for auth-session persistence:
 *   1. SecureStore keys must be legal (a ':' threw "Invalid key" → silent write
 *      failure, the original "re-login on every launch" bug). The shim enforces
 *      the real rule.
 *   2. Tokens live only in the keychain — never in plaintext AsyncStorage
 *      (SEC-01), including when the keychain write fails.
 *   3. Legacy installs migrate once and their old copies are deleted.
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

const ROTATED: AuthSession = { accessToken: 'synthetic-new-access', refreshToken: 'synthetic-new-refresh', expiresAt: 1785276060 };
const LEGACY_SECURE_KEYS = ['auth_v3_session', 'auth_v2_access', 'auth_v2_refresh', 'auth_v2_meta'];

/** No token value may appear anywhere outside the keychain. */
function expectNoPlaintextTokens(...sessions: AuthSession[]) {
  const dump = [...asyncMem.entries()].map(([k, v]) => `${k}=${v}`).join('\n');
  for (const s of sessions) {
    expect(dump).not.toContain(s.accessToken);
    expect(dump).not.toContain(s.refreshToken);
  }
}

describe('auth-storage persistence', () => {
  test('round-trips a session through save → load', async () => {
    await saveAuthSession(SESSION);
    expect(await loadAuthSession()).toEqual(SESSION);
  });

  test('save writes the keychain only — AsyncStorage never receives tokens', async () => {
    await saveAuthSession(SESSION);
    expect(asyncMem.get('auth:v4:invalidated')).toBeUndefined();
    expectNoPlaintextTokens(SESSION);
    expect(await SecureStore.getItemAsync('auth_v4_session')).toContain(SESSION.refreshToken);
  });

  test('keychain item is device-only and readable after first unlock', async () => {
    const spy = vi.spyOn(SecureStore, 'setItemAsync');
    await saveAuthSession(SESSION);
    expect(spy).toHaveBeenCalledWith('auth_v4_session', expect.any(String),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  });

  test('rotation and cold boot leave no plaintext copy', async () => {
    await saveAuthSession(SESSION);
    await saveAuthSession(ROTATED);
    expect(await loadAuthSession()).toEqual(ROTATED);
    expectNoPlaintextTokens(SESSION, ROTATED);
  });

  test('unavailable keychain never creates a plaintext fallback', async () => {
    vi.spyOn(SecureStore, 'setItemAsync').mockRejectedValue(new Error('keychain unavailable'));
    await expect(saveAuthSession(SESSION)).rejects.toThrow('securely');
    expect(asyncMem.get('auth:v4:invalidated')).toBe('1');
    expectNoPlaintextTokens(SESSION);
    expect(await loadAuthSession()).toBeNull();
  });

  test('a failed rotation write deletes the stale plaintext legacy copy', async () => {
    asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION }));
    vi.spyOn(SecureStore, 'setItemAsync').mockRejectedValue(new Error('keychain unavailable'));
    await expect(saveAuthSession(ROTATED)).rejects.toThrow('securely');
    expect(asyncMem.get('auth:v4:invalidated')).toBe('1');
    expect(asyncMem.has('auth:v2:session')).toBe(false);
  });

  test('a keychain write that does not read back is treated as failed', async () => {
    vi.spyOn(SecureStore, 'getItemAsync').mockResolvedValue(null);
    asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION }));
    expect(await loadAuthSession()).toBeNull();
    expect(asyncMem.has('auth:v2:session')).toBe(false);
  });

  test('clear() removes current and legacy copies from every store', async () => {
    await saveAuthSession(SESSION);
    for (const key of LEGACY_SECURE_KEYS) await SecureStore.setItemAsync(key, 'synthetic-legacy');
    asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...ROTATED }));
    await clearAuthSession();
    for (const key of ['auth_v4_session', ...LEGACY_SECURE_KEYS]) expect(await SecureStore.getItemAsync(key)).toBeNull();
    expect([...asyncMem.keys()]).toEqual(['auth:v4:invalidated']);
    expect(await loadAuthSession()).toBeNull();
  });

  test('no persisted session → null', async () => {
    expect(await loadAuthSession()).toBeNull();
  });

  test('account switch: the second account fully replaces the first', async () => {
    await saveAuthSession(SESSION);
    await clearAuthSession();
    await saveAuthSession(ROTATED);
    expect(await loadAuthSession()).toEqual(ROTATED);
    expect(await SecureStore.getItemAsync('auth_v4_session')).not.toContain(SESSION.refreshToken);
  });
});

describe('legacy migration', () => {
  test('plaintext AsyncStorage session migrates to the keychain and is deleted', async () => {
    asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION, revision: 100 }));
    expect(await loadAuthSession()).toEqual(SESSION);
    expectNoPlaintextTokens(SESSION);
    asyncMem.clear();
    expect(await loadAuthSession()).toEqual(SESSION);
  });

  test('v3 keychain session migrates and its old item is deleted', async () => {
    await SecureStore.setItemAsync('auth_v3_session', JSON.stringify({ v: 1, ...SESSION, revision: 100 }));
    expect(await loadAuthSession()).toEqual(SESSION);
    expect(await SecureStore.getItemAsync('auth_v3_session')).toBeNull();
    expect(await loadAuthSession()).toEqual(SESSION);
  });

  test('split v2 keychain keys migrate and are deleted', async () => {
    await SecureStore.setItemAsync('auth_v2_access', SESSION.accessToken);
    await SecureStore.setItemAsync('auth_v2_refresh', SESSION.refreshToken);
    await SecureStore.setItemAsync('auth_v2_meta', JSON.stringify({ v: 1, expiresAt: SESSION.expiresAt }));
    expect(await loadAuthSession()).toEqual(SESSION);
    for (const key of LEGACY_SECURE_KEYS) expect(await SecureStore.getItemAsync(key)).toBeNull();
    expect(await loadAuthSession()).toEqual(SESSION);
  });

  test('legacy fallback beats split keys that may contain tokens from different rotations', async () => {
    await SecureStore.setItemAsync('auth_v2_access', ROTATED.accessToken);
    await SecureStore.setItemAsync('auth_v2_refresh', SESSION.refreshToken);
    asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION }));
    expect(await loadAuthSession()).toEqual(SESSION);
  });

  test.each([
    ['writtenAt', 'writtenAt'],
    ['revision', 'writtenAt'],
    ['writtenAt', 'revision'],
  ] as const)('newer plaintext copy wins across %s v3 and %s fallback metadata', async (secureField, fallbackField) => {
    await SecureStore.setItemAsync('auth_v3_session', JSON.stringify({ v: 1, ...SESSION, [secureField]: 100 }));
    asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...ROTATED, [fallbackField]: 200 }));
    expect(await loadAuthSession()).toEqual(ROTATED);
  });

  test('newer v3 copy wins over an older plaintext copy', async () => {
    await SecureStore.setItemAsync('auth_v3_session', JSON.stringify({ v: 1, ...ROTATED, revision: 200 }));
    asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION, writtenAt: 100 }));
    expect(await loadAuthSession()).toEqual(ROTATED);
  });

  test('failed migration clears legacy plaintext and refuses restoration', async () => {
    asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION }));
    vi.spyOn(SecureStore, 'setItemAsync').mockRejectedValueOnce(new Error('keychain unavailable'));
    expect(await loadAuthSession()).toBeNull();
    expect(asyncMem.has('auth:v2:session')).toBe(false);
    expect(asyncMem.get('auth:v4:invalidated')).toBe('1');
    expect(await loadAuthSession()).toBeNull();
    expectNoPlaintextTokens(SESSION);
  });

  test('logout tombstone prevents restart restoration when keychain deletion fails', async () => {
    await saveAuthSession(SESSION);
    vi.spyOn(SecureStore, 'deleteItemAsync').mockRejectedValue(new Error('keychain locked'));
    await clearAuthSession();
    expect(await loadAuthSession()).toBeNull();
    expect(asyncMem.get('auth:v4:invalidated')).toBe('1');
  });

  test('a current keychain session wins and purges leftovers of an interrupted migration', async () => {
    await saveAuthSession(ROTATED);
    asyncMem.set('auth:v2:session', JSON.stringify({ v: 1, ...SESSION, revision: Date.now() + 60_000 }));
    expect(await loadAuthSession()).toEqual(ROTATED);
    expect(asyncMem.size).toBe(0);
  });

  test('corrupt legacy data is ignored', async () => {
    asyncMem.set('auth:v2:session', '{not json');
    await SecureStore.setItemAsync('auth_v3_session', JSON.stringify({ v: 2, ...SESSION }));
    expect(await loadAuthSession()).toBeNull();
  });
});

describe('serialization', () => {
  test('clear waits for a pending save so its late write cannot resurrect a session', async () => {
    const original = SecureStore.setItemAsync;
    let release!: () => void;
    let started!: () => void;
    const reachedWrite = new Promise<void>((resolve) => { started = resolve; });
    vi.spyOn(SecureStore, 'setItemAsync').mockImplementationOnce(async (key, value, options) => {
      started();
      await new Promise<void>((resolve) => { release = resolve; });
      await original(key, value, options);
    });
    const save = saveAuthSession(SESSION);
    await reachedWrite;
    const clear = clearAuthSession();
    release();
    await Promise.all([save, clear]);
    expect(await loadAuthSession()).toBeNull();
  });

  test('overlapping saves keep the final complete pair', async () => {
    await Promise.all([saveAuthSession(SESSION), saveAuthSession(ROTATED)]);
    expect(await loadAuthSession()).toEqual(ROTATED);
  });
});
