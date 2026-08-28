const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Keeps JitPack from being consulted for non-JitPack artifacts.
 *
 * `expo-updates` depends on `org.bouncycastle:bcutil-jdk15to18:1.81`, whose POM
 * declares `bcprov-jdk15to18:[1.81,1.82)` — a *range*. To resolve a range Gradle
 * cannot just fetch one POM; it must list all available versions, which means
 * requesting `maven-metadata.xml` from EVERY declared repository. The Expo root
 * template declares `https://www.jitpack.io` in `allprojects.repositories`, so
 * JitPack gets asked for an artifact it will never host. When JitPack is slow or
 * down, that request hangs until `Read timed out` and takes the build with it.
 *
 * The fix is content filtering: JitPack only ever serves `com.github.*` /
 * `com.gitlab.*` style coordinates built from source repos, so we tell Gradle
 * not to look there for anything else. Requests for `org.bouncycastle` (and
 * every other Maven Central artifact) then never touch JitPack at all.
 *
 * This is preferred over `resolutionStrategy.force`-ing a BouncyCastle version:
 * forcing pins a transitive security library to a hand-picked version that
 * `expo-updates` did not ask for, and it would have to be re-checked on every
 * Expo upgrade. Scoping the repository fixes the actual cause — the needless
 * network round-trip — and leaves version resolution to Gradle.
 *
 * `android/` is gitignored (CNG), so this must live as a config plugin: a
 * hand-edit of `android/build.gradle` is destroyed by the next `expo prebuild`
 * and never exists at all on EAS Build, which prebuilds from a clean checkout.
 */
const JITPACK_LINE = /maven \{ url ['"]https:\/\/(www\.)?jitpack\.io['"] \}/;

const SCOPED_JITPACK = `maven {
      url 'https://www.jitpack.io'
      // JitPack only hosts artifacts built from source repos. Without this
      // filter Gradle queries it for things like org.bouncycastle while
      // resolving version ranges, and a JitPack outage stalls the build.
      content {
        includeGroupByRegex 'com\\\\.github\\\\..*'
        includeGroupByRegex 'com\\\\.gitlab\\\\..*'
      }
    }`;

const withJitpackScoping = (config) =>
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        'with-jitpack-scoping: expected a Groovy android/build.gradle, got ' +
          cfg.modResults.language,
      );
    }

    // Already scoped (plugin ran twice, or the template changed shape).
    if (cfg.modResults.contents.includes('includeGroupByRegex')) return cfg;

    if (!JITPACK_LINE.test(cfg.modResults.contents)) {
      // The template no longer declares JitPack the way we expect. Don't fail
      // the build over it — but say so, because the timeout guard is now off.
      console.warn(
        '[with-jitpack-scoping] No unscoped jitpack.io repository found in ' +
          'android/build.gradle; leaving it untouched. If Expo changed the ' +
          'template, this plugin may no longer be needed.',
      );
      return cfg;
    }

    cfg.modResults.contents = cfg.modResults.contents.replace(JITPACK_LINE, SCOPED_JITPACK);
    return cfg;
  });

module.exports = withJitpackScoping;
