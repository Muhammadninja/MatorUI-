/**
 * Persistence for the auth session.
 *
 * DUAL-BACKED: written to BOTH `expo-secure-store` (iOS Keychain / Android
 * Keystore — encrypted) AND `@react-native-async-storage/async-storage`
 * (plaintext file in the app sandbox). SecureStore is preferred on read, but
 * some iOS release builds silently fail to persist keychain items across cold
 * launches (the write "succeeds" but the value is gone next launch) — which
 * logged users out on every restart. AsyncStorage persists reliably (the same
 * store already survives launches for the garage / likes / language), so it is
 * the fallback that guarantees the session survives.
 *
 * Security note: the refresh token in the AsyncStorage copy is NOT encrypted at
 * rest. Acceptable here — accounts are phone-OTP only (no password to steal),
 * the token still rotates, and SecureStore remains the primary encrypted store.
 *
 * All functions swallow I/O errors and return `null` rather than throw, so a
 * corrupt entry can't crash the auth flow on cold boot.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { debugLog } from '@/services/debug-log';

/** Legacy single-key SecureStore envelope (schema 1) — still read for upgrades. */
const LEGACY_KEY = 'auth:v1';

// SecureStore is capped at 2048 bytes per value, so the two JWTs live under
// their own keys (a lone JWT is well under the ceiling) plus a tiny meta blob.
const KEY_ACCESS = 'auth:v2:access';
const KEY_REFRESH = 'auth:v2:refresh';
const KEY_META = 'auth:v2:meta';

/** AsyncStorage fallback — a single JSON envelope, the reliable copy. */
const ASYNC_KEY = 'auth:v2:session';

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

/** Parse a JSON envelope string into a session, or null if invalid/mismatched. */
function parseEnvelope(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed) || parsed.v !== SCHEMA) return null;
    const { v: _v, ...session } = parsed;
    return session;
  } catch {
    return null;
  }
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  // 1) SecureStore split keys (encrypted, preferred).
  try {
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
      debugLog('auth', 'loadAuthSession → SecureStore (split keys)');
      return { accessToken, refreshToken, expiresAt };
    }
    // Legacy single-key envelope.
    const legacy = parseEnvelope(await SecureStore.getItemAsync(LEGACY_KEY));
    if (legacy) {
      debugLog('auth', 'loadAuthSession → SecureStore (legacy)');
      return legacy;
    }
  } catch (err) {
    debugLog('auth', 'loadAuthSession → SecureStore read failed', { message: (err as Error)?.message });
  }

  // 2) AsyncStorage fallback (the copy that survives when the keychain doesn't).
  try {
    const fallback = parseEnvelope(await AsyncStorage.getItem(ASYNC_KEY));
    if (fallback) {
      debugLog('auth', 'loadAuthSession → AsyncStorage fallback');
      return fallback;
    }
  } catch (err) {
    debugLog('auth', 'loadAuthSession → AsyncStorage read failed', { message: (err as Error)?.message });
  }

  debugLog('auth', 'loadAuthSession → no persisted session');
  return null;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  const envelope = JSON.stringify({ v: SCHEMA, ...session });

  // 1) AsyncStorage FIRST — the reliable store. Persistence must never depend
  //    solely on the keychain, which can silently drop values in release builds.
  try {
    await AsyncStorage.setItem(ASYNC_KEY, envelope);
    debugLog('auth', 'saveAuthSession → AsyncStorage OK');
  } catch (err) {
    debugLog('auth', 'saveAuthSession → AsyncStorage FAILED', { message: (err as Error)?.message });
  }

  // 2) SecureStore (encrypted, split keys) — best effort on top.
  try {
    const meta = JSON.stringify({ v: SCHEMA, expiresAt: session.expiresAt });
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, session.accessToken),
      SecureStore.setItemAsync(KEY_REFRESH, session.refreshToken),
      SecureStore.setItemAsync(KEY_META, meta),
    ]);
    await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => undefined);
    debugLog('auth', 'saveAuthSession → SecureStore OK');
  } catch (err) {
    debugLog('auth', 'saveAuthSession → SecureStore FAILED (AsyncStorage fallback covers it)', {
      message: (err as Error)?.message,
    });
  }
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS).catch(() => undefined),
    SecureStore.deleteItemAsync(KEY_REFRESH).catch(() => undefined),
    SecureStore.deleteItemAsync(KEY_META).catch(() => undefined),
    SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => undefined),
    AsyncStorage.removeItem(ASYNC_KEY).catch(() => undefined),
  ]);
}

// ── In-memory cache ────────────────────────────────────────────────────
//
// `getAuthToken()` in config/api.ts is called on EVERY HTTP request, so
// going through storage each time would add latency per call. We cache
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
