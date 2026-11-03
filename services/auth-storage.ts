/** Session persistence uses atomic envelopes in encrypted and fallback storage.
 * Revisions choose the newest complete copy if one store fails during rotation.
 * Legacy split SecureStore keys remain readable for migration only.
 * The existing AsyncStorage fallback remains plaintext in the app sandbox.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { debugLog } from '@/services/debug-log';

// ⚠️ SecureStore keys must be alphanumeric + `.`, `-`, `_` ONLY. A colon `:`
// throws "Invalid key provided to SecureStore" and the write silently fails —
// which is why the session never survived a cold boot (the original `auth:v1`
// key had the exact same bug from day one). Underscores are valid.
const KEY_ACCESS = 'auth_v2_access';
const KEY_REFRESH = 'auth_v2_refresh';
const KEY_META = 'auth_v2_meta';
const KEY_SESSION = 'auth_v3_session';

// AsyncStorage keys allow any string (colons are fine here) — the reliable copy.
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

type Envelope = AuthSession & { v: number; revision?: number };
let lastRevision = 0;
let storageTail: Promise<unknown> = Promise.resolve();

// A sign-out queued after a save must finish after every write from that save.
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageTail.then(operation, operation);
  storageTail = result.then(() => undefined, () => undefined);
  return result;
}

function parseEnvelope(raw: string | null): Envelope | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Envelope> | null;
    if (!value || value.v !== SCHEMA || typeof value.accessToken !== 'string' ||
        !value.accessToken || typeof value.refreshToken !== 'string' || !value.refreshToken) return null;
    if (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || value.revision < 0)) return null;
    return value as Envelope;
  } catch { return null; }
}

async function readCopies(): Promise<{ secure: Envelope | null; fallback: Envelope | null }> {
  const [secureRaw, fallbackRaw] = await Promise.all([
    SecureStore.getItemAsync(KEY_SESSION).catch(() => null),
    AsyncStorage.getItem(ASYNC_KEY).catch(() => null),
  ]);
  const secure = parseEnvelope(secureRaw);
  const fallback = parseEnvelope(fallbackRaw);
  lastRevision = Math.max(lastRevision, secure?.revision ?? 0, fallback?.revision ?? 0);
  return { secure, fallback };
}

function sessionFrom(envelope: Envelope): AuthSession {
  return {
    accessToken: envelope.accessToken,
    refreshToken: envelope.refreshToken,
    ...(envelope.expiresAt !== undefined ? { expiresAt: envelope.expiresAt } : {}),
  };
}

export function loadAuthSession(): Promise<AuthSession | null> {
  return serialized(async () => {
    const { secure, fallback } = await readCopies();
    // Prefer encrypted storage only when its revision is at least as recent.
    // A legacy fallback has revision zero and wins over potentially mixed split keys.
    const newest = secure && (!fallback || (secure.revision ?? 0) >= (fallback.revision ?? 0))
      ? secure : fallback;
    if (newest) return sessionFrom(newest);
    try {
      const [accessToken, refreshToken, metaRaw] = await Promise.all([
        SecureStore.getItemAsync(KEY_ACCESS), SecureStore.getItemAsync(KEY_REFRESH), SecureStore.getItemAsync(KEY_META),
      ]);
      if (!accessToken || !refreshToken) return null;
      let expiresAt: number | undefined;
      if (metaRaw) {
        try {
          const meta = JSON.parse(metaRaw) as { v?: number; expiresAt?: number };
          if (meta.v === SCHEMA) expiresAt = meta.expiresAt;
        } catch { /* Tokens remain usable if only legacy metadata is corrupt. */ }
      }
      return { accessToken, refreshToken, ...(expiresAt !== undefined ? { expiresAt } : {}) };
    } catch {
      debugLog('auth', 'loadAuthSession failed');
      return null;
    }
  });
}

export function saveAuthSession(session: AuthSession): Promise<void> {
  // Snapshot caller-owned data before waiting behind an earlier storage operation.
  const snapshot = { ...session };
  return serialized(async () => {
    await readCopies();
    lastRevision = Math.max(lastRevision + 1, Date.now());
    const envelope = JSON.stringify({ v: SCHEMA, revision: lastRevision, ...snapshot });
    let saved = false;
    try {
      await AsyncStorage.setItem(ASYNC_KEY, envelope);
      saved = true;
    } catch { debugLog('auth', 'saveAuthSession fallback write failed'); }
    try {
      // One encrypted write prevents access/refresh tokens from different rotations.
      await SecureStore.setItemAsync(KEY_SESSION, envelope);
      saved = true;
    } catch { debugLog('auth', 'saveAuthSession encrypted write failed'); }
    if (saved) {
      await Promise.all([KEY_ACCESS, KEY_REFRESH, KEY_META].map((key) =>
        SecureStore.deleteItemAsync(key).catch(() => undefined)));
    }
  });
}

export function clearAuthSession(): Promise<void> {
  return serialized(async () => {
    await Promise.all([
      ...[KEY_SESSION, KEY_ACCESS, KEY_REFRESH, KEY_META].map((key) =>
        SecureStore.deleteItemAsync(key).catch(() => undefined)),
      AsyncStorage.removeItem(ASYNC_KEY).catch(() => undefined),
    ]);
  });
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
