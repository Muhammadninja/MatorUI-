import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const constants = vi.hoisted(() => ({
  expoConfig: { android: { package: 'com.mator.myapp' }, scheme: 'mator', updates: { enabled: true }, extra: { e2e: false, appEnvironment: { name: 'local', apiBaseUrl: 'http://127.0.0.1:3300',
    httpDomains: '', allowDevOtp: true } } },
}));
vi.mock('expo-constants', () => ({ default: constants }));
vi.mock('@/services/auth-storage', () => ({ getCurrentSession: () => null }));
import { getApiBaseUrl } from '@/config/api';
import { allowLocalDevOtp, getAppEnvironment } from '@/config/environment';

beforeEach(() => {
  vi.stubGlobal('__DEV__', true);
  constants.expoConfig.android.package = 'com.mator.myapp';
  constants.expoConfig.scheme = 'mator';
  constants.expoConfig.updates.enabled = true;
  constants.expoConfig.extra.e2e = false;
  constants.expoConfig.extra.appEnvironment = { name: 'local', apiBaseUrl: 'http://127.0.0.1:3300',
    httpDomains: '', allowDevOtp: true };
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('snapshot wins over stale Expo virtual environment values', () => {
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.mator.uz');
  expect(getAppEnvironment().apiBaseUrl).toBe('http://127.0.0.1:3300');
  vi.unstubAllEnvs();
});

test('local dev can consume the backend dev OTP', () => {
  expect(allowLocalDevOtp()).toBe(true);
});

test('release never consumes a dev OTP even with a contaminated local snapshot', () => {
  vi.stubGlobal('__DEV__', false);
  expect(allowLocalDevOtp()).toBe(false);
});

test('production dev sessions also ignore leaked OTPs', () => {
  constants.expoConfig.extra.appEnvironment.name = 'production';
  constants.expoConfig.extra.appEnvironment.apiBaseUrl = 'https://api.mator.uz';
  expect(allowLocalDevOtp()).toBe(false);
});

test('local marker cannot enable OTP for a remote API', () => {
  constants.expoConfig.extra.appEnvironment.apiBaseUrl = 'https://api.mator.uz';
  expect(allowLocalDevOtp()).toBe(false);
});


test('bundled E2E permits only the separate identity and exact mock, without OTP echo', () => {
  vi.stubGlobal('__DEV__', false);
  constants.expoConfig.extra.appEnvironment.apiBaseUrl = 'http://127.0.0.1:8080';
  constants.expoConfig.extra.appEnvironment.allowDevOtp = false;
  constants.expoConfig.extra.e2e = true;
  expect(() => getApiBaseUrl()).toThrow();
  constants.expoConfig.android.package = 'com.mator.e2e';
  constants.expoConfig.scheme = 'mator-e2e';
  constants.expoConfig.updates.enabled = false;
  expect(getApiBaseUrl()).toBe('http://127.0.0.1:8080');
  expect(allowLocalDevOtp()).toBe(false);
  constants.expoConfig.extra.appEnvironment.apiBaseUrl = 'https://api.mator.uz';
  expect(() => getApiBaseUrl()).toThrow();
});
test('ordinary bundled production config still rejects loopback and OTP echo', () => {
  vi.stubGlobal('__DEV__', false);
  expect(() => getApiBaseUrl()).toThrow();
  constants.expoConfig.extra.appEnvironment = { name: 'production', apiBaseUrl: 'https://api.mator.uz',
    httpDomains: '', allowDevOtp: false };
  expect(getApiBaseUrl()).toBe('https://api.mator.uz');
  constants.expoConfig.extra.appEnvironment.allowDevOtp = true;
  expect(() => getApiBaseUrl()).toThrow();
});
