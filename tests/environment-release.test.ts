import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { environmentFrom } = require('../config/environment-policy.cjs');
const appConfig = require('../app.config.js');
const eas = require('../eas.json');

const production = {
  NODE_ENV: 'production', EXPO_PUBLIC_APP_ENV: 'production',
  EXPO_PUBLIC_API_BASE_URL: 'https://api.mator.uz',
  EXPO_PUBLIC_ALLOW_DEV_OTP: 'false', EXPO_PUBLIC_HTTP_DOMAINS: '',
};

describe('release environment boundary', () => {
  test.each([
    'http://localhost:3300', 'http://127.0.0.1:3300', 'http://127.1:3300',
    'http://[::1]:3300', 'https://192.168.1.2', 'https://10.0.0.1',
    'https://172.16.0.1', 'https://api.internal', 'http://api.mator.uz',
    'https://api.mator.uz@127.0.0.1',
  ])('rejects non-production API %s', (url) => {
    expect(() => environmentFrom({ ...production, EXPO_PUBLIC_API_BASE_URL: url }, true)).toThrow();
  });

  test.each(['AUTH_DEV_MODE', 'EXPO_PUBLIC_AUTH_DEV_MODE', 'EXPO_PUBLIC_ALLOW_DEV_OTP'])('rejects %s in release', (key) => {
    expect(() => environmentFrom({ ...production, [key]: 'true' }, true)).toThrow();
  });

  test('rejects the local environment in release even when auth echo is disabled', () => {
    expect(() => environmentFrom({ ...production, EXPO_PUBLIC_APP_ENV: 'local',
      EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3300' }, true)).toThrow();
  });

  test('requires every production domain to use the real API', () => {
    expect(() => environmentFrom({ ...production, EXPO_PUBLIC_HTTP_DOMAINS: 'catalog,auth' }, true)).toThrow();
  });

  test('accepts the real EAS production profile and forbids development OTP', () => {
    const value = environmentFrom(eas.build.production.env, true);
    expect(value).toMatchObject({ name: 'production', apiBaseUrl: 'https://api.mator.uz', allowDevOtp: false, httpDomains: '' });
  });

  test('accepts local dev auth only with an explicitly selected loopback environment', () => {
    expect(environmentFrom({ EXPO_PUBLIC_APP_ENV: 'local', EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3300',
      EXPO_PUBLIC_ALLOW_DEV_OTP: 'true' }, false).allowDevOtp).toBe(true);
    expect(() => environmentFrom({ EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_API_BASE_URL: 'https://api.mator.uz',
      EXPO_PUBLIC_ALLOW_DEV_OTP: 'true' }, false)).toThrow();
  });

  describe('the Android map key', () => {
    const configWith = (key: string | undefined) => {
      const before = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
      if (key === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
      else process.env.GOOGLE_MAPS_ANDROID_API_KEY = key;
      try {
        return appConfig({ config: { extra: {}, plugins: ['expo-router'] } });
      } finally {
        if (before === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
        else process.env.GOOGLE_MAPS_ANDROID_API_KEY = before;
      }
    };
    const mapsPlugin = (config: { plugins: unknown[] }) =>
      config.plugins.find((p) => Array.isArray(p) && p[0] === 'react-native-maps') as [string, object];

    test('goes to the native build, and the app learns only that it is there', () => {
      const config = configWith(' a-key ');
      expect(mapsPlugin(config)[1]).toEqual({ androidGoogleMapsApiKey: 'a-key' });
      expect(config.extra.googleMapsConfigured).toBe(true);
      expect(JSON.stringify(config.extra)).not.toContain('a-key');
    });

    test.each([undefined, '', '   '])('absent (%j), the app knows not to draw the map', (key) => {
      const config = configWith(key);
      expect(mapsPlugin(config)[1]).toEqual({});
      expect(config.extra.googleMapsConfigured).toBe(false);
    });

    test('the other plugins stay', () => {
      expect(configWith('a-key').plugins).toContain('expo-router');
    });
  });

  test('app config snapshots only the public environment shape', () => {
    const before = { ...process.env };
    try {
      Object.assign(process.env, production, { PRIVATE_TEST_SECRET: 'must-not-be-public' });
      const config = appConfig({ config: { extra: { existing: true } } });
      expect(config.extra.appEnvironment).toEqual({ name: 'production', apiBaseUrl: 'https://api.mator.uz',
        httpDomains: '', allowDevOtp: false });
      expect(JSON.stringify(config)).not.toContain('must-not-be-public');
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
      Object.assign(process.env, before);
    }
  });
});
