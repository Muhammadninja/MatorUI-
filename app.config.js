const { environmentFrom } = require('./config/environment-policy.cjs');

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || '';
  const release = process.env.NODE_ENV === 'production' || ['production', 'preview'].includes(profile);
  const appEnvironment = environmentFrom(process.env, release);
  if (profile === 'production' && appEnvironment.name !== 'production') {
    throw new Error('The production build profile requires the production environment.');
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
    ],
    extra: {
      ...config.extra,
      googleMapsConfigured: Boolean(googleMapsKey),
      // Public, resolved once by the launcher/config process. Expo 56's virtual
      // env module can otherwise override shell variables with stale .env files.
      appEnvironment,
      ...(appEnvironment.name === 'local' ? {
        sentry: { dsn: '', environment: 'local', enableInDev: false },
      } : {}),
    },
  };
};
