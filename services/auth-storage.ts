/**
 * Encrypted persistence for the auth session.
 *
 * Backed by `expo-secure-store` so tokens are stored in the iOS Keychain /
 * Android Keystore — never plain-text on disk. A single JSON envelope
 * holds both tokens + an issued-at timestamp so future schema migrations
 * (e.g. add `scope`) can detect-and-discard.
 *
 * All functions are memory-safe to call from anywhere — they swallow
 * SecureStore I/O errors and return `null` rather than throw, so a
 * corrupt keychain entry can't crash the auth flow on cold boot.
 */

import * as SecureStore from 'expo-secure-store';

import { debugLog } from '@/services/debug-log';

/**
 * Legacy single-key envelope (schema 1). Still read on load for back-compat so
 * users who signed in before the split don't get logged out on upgrade.
 */
const LEGACY_KEY = 'auth:v1';

/**
 * expo-secure-store rejects values larger than 2048 bytes (iOS Keychain /
 * Android). A single JSON envelope holding BOTH JWTs routinely exceeds that on
 * real backends → the write throws, and previously that throw was swallowed, so
 * the session silently never persisted and the user re-authenticated on every
 * cold boot. We now store each token under its OWN key (a lone JWT is well
 * under 2048) plus a tiny meta blob, so nothing ever hits the ceiling.
 */
const KEY_ACCESS = 'auth:v2:access';
const KEY_REFRESH = 'auth:v2:refresh';
const KEY_META = 'auth:v2:meta';
const SCHEMA = 1;

export type AuthSession = {
  /** Short-lived bearer token attached to every authenticated request. */
  accessToken: string;
  /** Used once by the refresh flow to exchange for a new pair. */
  refreshToken: string;
  /** Unix-seconds — local copy of the access-token expiry. May be approximate
   *  when the backend doesn't return one; refresh is best-effort regardless. */
  expiresAt?: number;
};

type Envelope = AuthSession & { v: number };

function isEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<Envelope>;
  return (
    typeof e.v === 'number' &&
    typeof e.accessToken === 'string' &&
    typeof e.refreshToken === 'string'
  );
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  try {
    // Preferred: the split-key layout (schema 2+).
    const [accessToken, refreshToken, metaRaw] = await Promise.all([
      SecureStore.getItemAsync(KEY_ACCESS),
      SecureStore.getItemAsync(KEY_REFRESH),
      SecureStore.getItemAsync(KEY_META),
    ]);
    if (accessToken && refreshToken) {
      let expiresAt: number | undefined;
      if (metaRaw) {
        const meta = JSON.parse(metaRaw) as { v?: number; expiresAt?: number };
        if (meta.v === SCHEMA) expiresAt = meta.expiresAt;
      }
      debugLog('auth', 'loadAuthSession → restored (split keys)');
      return { accessToken, refreshToken, expiresAt };
    }

    // Back-compat: fall back to the legacy single-key envelope.
    const raw = await SecureStore.getItemAsync(LEGACY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed) || parsed.v !== SCHEMA) return null;
    const { v: _v, ...session } = parsed;
    debugLog('auth', 'loadAuthSession → restored (legacy key)');
    return session;
  } catch (err) {
    debugLog('auth', 'loadAuthSession FAILED', { message: (err as Error)?.message });
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  try {
    const meta = JSON.stringify({ v: SCHEMA, expiresAt: session.expiresAt });
    // Each token under its own key so neither trips the 2048-byte ceiling.
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, session.accessToken),
      SecureStore.setItemAsync(KEY_REFRESH, session.refreshToken),
      SecureStore.setItemAsync(KEY_META, meta),
    ]);
    // Verify the write actually landed — if the keychain silently dropped it we
    // want that in the logs, not a mystery re-login on the next cold boot.
    const check = await SecureStore.getItemAsync(KEY_REFRESH);
    if (check !== session.refreshToken) {
      debugLog('auth', 'saveAuthSession WARNING — refresh token did not read back', {
        wrote: session.refreshToken.length,
        readBack: check?.length ?? 0,
      });
    } else {
      debugLog('auth', 'saveAuthSession OK — session persisted');
    }
    // Drop any stale legacy envelope so we don't hydrate an old session later.
    await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => undefined);
  } catch (err) {
    // No longer silent: a failed persist means the user won't survive a cold
    // boot, so it MUST be visible in the device console to be diagnosable.
    debugLog('auth', 'saveAuthSession FAILED — session will NOT survive restart', {
      message: (err as Error)?.message,
    });
  }
}

export async function clearAuthSession(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_ACCESS),
      SecureStore.deleteItemAsync(KEY_REFRESH),
      SecureStore.deleteItemAsync(KEY_META),
      SecureStore.deleteItemAsync(LEGACY_KEY),
    ]);
  } catch (err) {
    debugLog('auth', 'clearAuthSession FAILED', { message: (err as Error)?.message });
  }
}

// ── In-memory cache ────────────────────────────────────────────────────
//
// `getAuthToken()` in config/api.ts is called on EVERY HTTP request, so
// going through SecureStore each time would add ~5ms per call. We cache
// the most recent session in module state; `setCurrentSession()` is
// called whenever the auth-flow hydrates / signs in / refreshes / signs
// out, keeping the cache in lock-step with disk.

let cachedSession: AuthSession | null = null;

export function getCurrentSession(): AuthSession | null {
  return cachedSession;
}

export function setCurrentSession(session: AuthSession | null): void {
  cachedSession = session;
}
