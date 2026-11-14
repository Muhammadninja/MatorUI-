const { environmentFrom } = require('./config/environment-policy.cjs');

// mator.uz's apple-app-site-association names only the production app, so any
// other identity drops the association rather than claim the domain.
const withoutProductionDomains = ({ associatedDomains, ...ios } = {}) => ios;

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || '';
  const e2e = process.env.MATOR_E2E === '1' && profile === 'e2e';
  if ((process.env.MATOR_E2E === '1' || profile === 'e2e') && !e2e) {
    throw new Error('Test builds require both MATOR_E2E=1 and EAS_BUILD_PROFILE=e2e.');
  }
  const release = process.env.NODE_ENV === 'production' || ['production', 'internal', 'preview', 'staging'].includes(profile);
  const appEnvironment = environmentFrom(process.env, release && !e2e);
  if (['production', 'internal'].includes(profile) && appEnvironment.name !== 'production') {
    throw new Error('The production build profile requires the production environment.');
  }
  if (profile === 'staging' && appEnvironment.name !== 'staging') {
    throw new Error('The staging build profile requires the staging environment.');
  }
  // Any build pointed at staging gets its own identity, so it installs beside the
  // store app and never shares its keychain, storage, deep links or OTA channel.
  const staging = appEnvironment.name === 'staging';
  if (e2e && (appEnvironment.name !== 'local' || appEnvironment.apiBaseUrl !== 'http://127.0.0.1:8080' || appEnvironment.allowDevOtp || appEnvironment.httpDomains)) {
    throw new Error('E2E requires the isolated loopback mock, all HTTP domains and no development OTP.');
  }
  // The Android map needs this at build time, and crashes without it. Baked into the build,
  // so it is public: restrict it to this app's package and signing certificate in Google
  // Cloud. iOS uses Apple Maps and needs none. With none set, the app offers address search
  // in place of the Android map (services/delivery-map.ts).
  const googleMapsKey = (process.env.GOOGLE_MAPS_ANDROID_API_KEY || '').trim();
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ['react-native-maps', googleMapsKey ? { androidGoogleMapsApiKey: googleMapsKey } : {}],
      ...(e2e ? ['./plugins/with-e2e-loopback'] : []),
    ],
    ...(e2e ? {
      name: 'Mator E2E', scheme: 'mator-e2e',
      android: { ...config.android, package: 'com.mator.e2e' },
      ios: { ...withoutProductionDomains(config.ios), bundleIdentifier: 'com.mator.e2e' },
      updates: { enabled: false },
    } : {}),
    ...(staging ? {
      name: 'Mator Staging', scheme: 'mator-staging',
      android: { ...config.android, package: 'com.mator.myapp.staging' },
      ios: { ...withoutProductionDomains(config.ios), bundleIdentifier: 'com.fotih12.mator.staging' },
      updates: { enabled: false },
    } : {}),
    extra: {
      ...config.extra,
      googleMapsConfigured: Boolean(googleMapsKey),
      // Public, resolved once by the launcher/config process. Expo 56's virtual
      // env module can otherwise override shell variables with stale .env files.
      appEnvironment,
      e2e,
      ...(appEnvironment.name === 'local' ? {
        sentry: { dsn: '', environment: 'local', enableInDev: false },
      } : {}),
      ...(staging ? { sentry: { ...config.extra?.sentry, environment: 'staging' } } : {}),
    },
  };
};
