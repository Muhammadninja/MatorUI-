import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const constants = vi.hoisted(() => ({
  expoConfig: { extra: { appEnvironment: { name: 'local', apiBaseUrl: 'http://127.0.0.1:3300',
    httpDomains: '', allowDevOtp: true } } },
}));
vi.mock('expo-constants', () => ({ default: constants }));
import { allowLocalDevOtp, getAppEnvironment } from '@/config/environment';

beforeEach(() => {
  vi.stubGlobal('__DEV__', true);
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
