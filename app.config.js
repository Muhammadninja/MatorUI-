const { environmentFrom } = require('./config/environment-policy.cjs');

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || '';
  const release = process.env.NODE_ENV === 'production' || ['production', 'preview'].includes(profile);
  const appEnvironment = environmentFrom(process.env, release);
  if (profile === 'production' && appEnvironment.name !== 'production') {
    throw new Error('The production build profile requires the production environment.');
  }
  return {
    ...config,
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
