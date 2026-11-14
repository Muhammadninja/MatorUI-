// Local data stored for one API is never read by a build that talks to another.
import { beforeEach, expect, test, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());
const environment = vi.hoisted(() => ({ name: 'production', apiBaseUrl: 'https://api.mator.uz',
  httpDomains: '', allowDevOtp: false }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { storage.set(key, value); },
  removeItem: async (key: string) => { storage.delete(key); },
  clear: async () => { storage.clear(); },
} }));
vi.mock('@/config/environment', () => ({ getAppEnvironment: () => environment, allowLocalDevOtp: () => false,
  isDedicatedE2EApp: () => false }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { getCurrentSession, loadAuthSession, saveAuthSession, setCurrentSession } from '@/services/auth-storage';
import { ensureStorageEnvironment, STORAGE_ENVIRONMENT_KEY } from '@/services/storage-environment';

const PRODUCTION_SESSION = { accessToken: 'prod-access', refreshToken: 'prod-refresh' };

async function seedProductionInstall() {
  await saveAuthSession(PRODUCTION_SESSION);
  setCurrentSession(PRODUCTION_SESSION);
  await AsyncStorage.setItem('@mator/active-vehicle/v1', '{"id":"veh_1"}');
  await AsyncStorage.setItem('likes:v2', '["part_1"]');
  await AsyncStorage.setItem('cart:v1:usr_1', '{"items":[1]}');
}

beforeEach(() => {
  storage.clear();
  (SecureStore as unknown as { __resetSecureStore(): void }).__resetSecureStore();
  setCurrentSession(null);
  Object.assign(environment, { name: 'production', apiBaseUrl: 'https://api.mator.uz' });
});

test('an existing production install keeps everything on first run of the guard', async () => {
  await seedProductionInstall();
  await expect(ensureStorageEnvironment()).resolves.toBe('initialized');
  await expect(loadAuthSession()).resolves.toEqual(PRODUCTION_SESSION);
  expect(storage.get('likes:v2')).toBe('["part_1"]');
  expect(storage.get(STORAGE_ENVIRONMENT_KEY)).toBe('production https://api.mator.uz');
  await expect(ensureStorageEnvironment()).resolves.toBe('kept');
});

test('switching the API wipes tokens, Garage, favorites and cart before anything hydrates', async () => {
  await seedProductionInstall();
  await ensureStorageEnvironment();
  Object.assign(environment, { name: 'staging', apiBaseUrl: 'https://api.staging.mator.uz' });
  await expect(ensureStorageEnvironment()).resolves.toBe('wiped');
  await expect(loadAuthSession()).resolves.toBeNull();
  expect(getCurrentSession()).toBeNull();
  for (const key of ['@mator/active-vehicle/v1', 'likes:v2', 'cart:v1:usr_1', 'auth:v2:session']) {
    expect(storage.has(key)).toBe(false);
  }
  for (const key of ['auth_v3_session', 'mator_staging_access_v1']) {
    expect(await SecureStore.getItemAsync(key)).toBeNull();
  }
  expect(storage.get(STORAGE_ENVIRONMENT_KEY)).toBe('staging https://api.staging.mator.uz');
});

test('a storage read failure clears nothing', async () => {
  await seedProductionInstall();
  const spy = vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unavailable'));
  await expect(ensureStorageEnvironment()).resolves.toBe('kept');
  spy.mockRestore();
  await expect(loadAuthSession()).resolves.toEqual(PRODUCTION_SESSION);
});
