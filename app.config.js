const { environmentFrom } = require('./config/environment-policy.cjs');

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || '';
  const e2e = process.env.MATOR_E2E === '1' && profile === 'e2e';
  if ((process.env.MATOR_E2E === '1' || profile === 'e2e') && !e2e) {
    throw new Error('Test builds require both MATOR_E2E=1 and EAS_BUILD_PROFILE=e2e.');
  }
  const release = process.env.NODE_ENV === 'production' || ['production', 'internal', 'preview'].includes(profile);
  const appEnvironment = environmentFrom(process.env, release && !e2e);
  if (['production', 'internal'].includes(profile) && appEnvironment.name !== 'production') {
    throw new Error('The production build profile requires the production environment.');
  }
  if (e2e && (appEnvironment.name !== 'local' || appEnvironment.apiBaseUrl !== 'http://127.0.0.1:8080' || appEnvironment.allowDevOtp || appEnvironment.httpDomains)) {
    throw new Error('E2E requires the isolated loopback mock, all HTTP domains and no development OTP.');
  }
  return {
    ...config,
    ...(e2e ? {
      name: 'Mator E2E', scheme: 'mator-e2e',
      android: { ...config.android, package: 'com.mator.e2e', usesCleartextTraffic: true },
      ios: { ...config.ios, bundleIdentifier: 'com.mator.e2e' },
      updates: { enabled: false },
    } : {}),
    extra: {
      ...config.extra,
      // Public, resolved once by the launcher/config process. Expo 56's virtual
      // env module can otherwise override shell variables with stale .env files.
      appEnvironment,
      ...(appEnvironment.name === 'local' ? {
        sentry: { dsn: '', environment: 'local', enableInDev: false },
      } : {}),
    },
  };
};
