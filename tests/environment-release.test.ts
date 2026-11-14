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
      expect(config.extra.e2e).toBe(false);
      expect(config.plugins).not.toContain('./plugins/with-e2e-loopback');
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
      Object.assign(process.env, before);
    }
  });
});


describe('dedicated E2E app boundary', () => {
  function resolve(overrides: Record<string, string> = {}) {
    const before = { ...process.env };
    try {
      Object.assign(process.env, production, {
        MATOR_E2E: '1', EAS_BUILD_PROFILE: 'e2e', EXPO_PUBLIC_APP_ENV: 'local',
        EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8080',
      }, overrides);
      return appConfig({ config: { android: { package: 'com.mator.myapp' }, scheme: 'mator' } });
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
      Object.assign(process.env, before);
    }
  }
  test('creates a distinct loopback-only app with updates disabled', () => {
    const config = resolve();
    expect(config.android.package).toBe('com.mator.e2e');
    expect(config.scheme).toBe('mator-e2e');
    expect(config.updates.enabled).toBe(false);
    expect(config.plugins).toContain('./plugins/with-e2e-loopback');
    expect(config.plugins.some((plugin: unknown) =>
      Array.isArray(plugin) && plugin[0] === 'react-native-maps')).toBe(true);
    expect(config.extra.appEnvironment.allowDevOtp).toBe(false);
  });
  test.each(['production', 'internal', 'preview', 'development'])('rejects test switch in %s', (profile) => {
    expect(() => resolve({ EAS_BUILD_PROFILE: profile })).toThrow();
  });
  test('rejects missing switch and remote APIs', () => {
    expect(() => resolve({ MATOR_E2E: '0' })).toThrow();
    expect(() => resolve({ EXPO_PUBLIC_API_BASE_URL: 'https://api.mator.uz' })).toThrow();
    expect(() => resolve({ EXPO_PUBLIC_ALLOW_DEV_OTP: 'true' })).toThrow();
  });
});

describe('staging app identity', () => {
  const base = require('../app.json').expo;
  function resolve(env: Record<string, string>) {
    const before = { ...process.env };
    try {
      Object.assign(process.env, env);
      const config = JSON.parse(JSON.stringify(base));
      // As app.json has it once the iOS AutoFill branch lands.
      config.ios.associatedDomains = ['webcredentials:mator.uz'];
      return appConfig({ config });
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
      Object.assign(process.env, before);
    }
  }
  const stagingProfile = { NODE_ENV: 'production', EAS_BUILD_PROFILE: 'staging', ...eas.build.staging.env };

  test('the staging profile points at the staging API only, with no development auth', () => {
    expect(eas.build.staging.env).toMatchObject({ EXPO_PUBLIC_APP_ENV: 'staging',
      EXPO_PUBLIC_API_BASE_URL: 'https://api.staging.mator.uz', EXPO_PUBLIC_ALLOW_DEV_OTP: 'false', AUTH_DEV_MODE: 'false' });
    expect(environmentFrom(eas.build.staging.env, true)).toMatchObject({ name: 'staging',
      apiBaseUrl: 'https://api.staging.mator.uz', allowDevOtp: false, httpDomains: '' });
    expect(eas.build.staging.channel).toBe('staging');
    expect(eas.build.staging.distribution).toBe('internal');
    expect(eas.submit.staging).toBeUndefined();
    expect(JSON.stringify(eas.build.staging)).not.toMatch(/PASSWORD|SECRET|TOKEN|mator-tester/i);
  });

  test('a staging build installs beside production under its own identity, with OTA off', () => {
    const config = resolve(stagingProfile);
    expect(config.name).toBe('Mator Staging');
    expect(config.scheme).toBe('mator-staging');
    expect(config.ios.bundleIdentifier).toBe('com.fotih12.mator.staging');
    expect(config.android.package).toBe('com.mator.myapp.staging');
    expect(config.ios.icon).toBe('./assets/MATOR-app-icons/staging/icon.png');
    expect(config.icon).toBe('./assets/MATOR-app-icons/staging/icon.png');
    expect(config.updates).toEqual({ enabled: false });
    expect(config.extra.sentry.environment).toBe('staging');
    expect(config.extra.appEnvironment).toEqual({ name: 'staging', apiBaseUrl: 'https://api.staging.mator.uz',
      httpDomains: '', allowDevOtp: false });
  });

  test('a staging build does not claim mator.uz, which names only the production app', () => {
    expect(resolve(stagingProfile).ios.associatedDomains).toBeUndefined();
    expect(resolve({ ...production, EAS_BUILD_PROFILE: 'production' }).ios.associatedDomains)
      .toEqual(['webcredentials:mator.uz']);
  });

  test('the production identity is untouched', () => {
    const config = resolve({ ...production, EAS_BUILD_PROFILE: 'production' });
    expect(config.name).toBe('Mator');
    expect(config.scheme).toBe('mator');
    expect(config.ios.bundleIdentifier).toBe('com.fotih12.mator');
    expect(config.android.package).toBe('com.mator.myapp');
    expect(config.icon).toBe(base.icon);
    expect(config.ios.icon).toEqual(base.ios.icon);
    expect(config.updates).toEqual(base.updates);
    expect(config.extra.sentry.environment).toBe('production');
  });

  test.each([
    { EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_API_BASE_URL: 'https://api.mator.uz' },
    { EXPO_PUBLIC_API_BASE_URL: 'https://api.mator.uz' },
    { EXPO_PUBLIC_API_BASE_URL: 'https://api.staging.matorui.com' },
    { EXPO_PUBLIC_API_BASE_URL: 'https://mator-tester:pw@api.staging.mator.uz' },
    { EXPO_PUBLIC_APP_ENV: 'stagng' },
  ])('the staging profile fails the build on a wrong environment: %o', (patch) => {
    expect(() => resolve({ ...stagingProfile, ...patch })).toThrow();
  });

  test('production profiles refuse the staging environment', () => {
    for (const profile of ['production', 'internal']) {
      expect(() => resolve({ ...stagingProfile, EAS_BUILD_PROFILE: profile })).toThrow();
    }
  });
});
