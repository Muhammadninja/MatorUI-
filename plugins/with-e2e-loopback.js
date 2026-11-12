const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

// Registered only for the separately identified disposable E2E app. Expo's
// standard config does not consume android.usesCleartextTraffic.
module.exports = (config) => withAndroidManifest(config, (cfg) => {
  if (cfg.android?.package !== 'com.mator.e2e') {
    throw new Error('Loopback HTTP is restricted to the dedicated E2E app.');
  }
  AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults).$['android:usesCleartextTraffic'] = 'true';
  return cfg;
});
