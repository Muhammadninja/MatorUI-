import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

/**
 * One-time Sentry init. Call at the very top of `app/_layout.tsx`,
 * before any component renders. Reads the DSN from
 * `expo.extra.sentry.dsn` so each env (dev / staging / prod) can have
 * its own.
 *
 * No-op when the DSN is missing — local dev runs without it.
 */

type ExpoExtra = {
  sentry?: {
    dsn?: string;
    environment?: string;
    release?: string;
    enableInDev?: boolean;
  };
};

export function initSentry(): void {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
  const dsn = extra.sentry?.dsn;
  if (!dsn) return;

  // Skip in dev unless explicitly enabled — Sentry's session-replay and
  // sampling churn is noisy during normal development.
  if (__DEV__ && !extra.sentry?.enableInDev) return;

  Sentry.init({
    dsn,
    environment: extra.sentry?.environment ?? 'production',
    release: extra.sentry?.release,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    // App-specific tags: helpful for filtering on the dashboard.
    initialScope: {
      tags: { platform: 'mobile' },
    },
  });
}

/** Re-export the surface for callers (capture, breadcrumb, addUser). */
export { Sentry };
