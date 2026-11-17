/** Session persistence: one atomic envelope in the platform keychain only.
 * iOS Keychain / Android Keystore via SecureStore. Tokens are never written to
 * AsyncStorage (plaintext in the app sandbox and its backups — SEC-01).
 * Older installs kept copies in AsyncStorage, the v3 keychain item and split
 * v2 keychain keys; those are read once for migration and then deleted.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { debugLog } from '@/services/debug-log';

// ⚠️ SecureStore keys must be alphanumeric + `.`, `-`, `_` ONLY. A colon `:`
// throws "Invalid key provided to SecureStore" and the write silently fails —
// which is why the session never survived a cold boot (the original `auth:v1`
// key had the exact same bug from day one). Underscores are valid.
const KEY_SESSION = 'auth_v4_session';

// A new key, because expo-secure-store only updates the value of an existing
// item and never its accessibility. AFTER_FIRST_UNLOCK keeps the session
// readable on background launches; THIS_DEVICE_ONLY keeps it out of backups.
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

// Legacy locations — migration reads and deletion only, never written.
const LEGACY_SECURE_SESSION = 'auth_v3_session';
const LEGACY_SPLIT_KEYS = ['auth_v2_access', 'auth_v2_refresh', 'auth_v2_meta'] as const;
const LEGACY_ASYNC_KEY = 'auth:v2:session';

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

type Envelope = AuthSession & { v: number; revision?: number; writtenAt?: number };
let lastRevision = 0;
let storageTail: Promise<unknown> = Promise.resolve();

// A sign-out queued after a save must finish after every write from that save.
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageTail.then(operation, operation);
  storageTail = result.then(() => undefined, () => undefined);
  return result;
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseEnvelope(raw: string | null): Envelope | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Envelope> | null;
    if (!value || value.v !== SCHEMA || typeof value.accessToken !== 'string' ||
        !value.accessToken || typeof value.refreshToken !== 'string' || !value.refreshToken) return null;
    // eea9b09 used writtenAt for the same monotonic ordering. Read both forms
    // so migration never prefers an older copy after a failed legacy write.
    const revision = isRevision(value.revision) ? value.revision
      : isRevision(value.writtenAt) ? value.writtenAt : undefined;
    if (revision === undefined && (value.revision !== undefined || value.writtenAt !== undefined)) return null;
    return { ...value, revision } as Envelope;
  } catch { return null; }
}

function sessionFrom(envelope: Envelope): AuthSession {
  return {
    accessToken: envelope.accessToken,
    refreshToken: envelope.refreshToken,
    ...(envelope.expiresAt !== undefined ? { expiresAt: envelope.expiresAt } : {}),
  };
}

async function readSecure(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key, SECURE_OPTIONS).catch(() => null);
}

async function readLegacySplit(): Promise<AuthSession | null> {
  try {
    const [accessToken, refreshToken, metaRaw] = await Promise.all(
      LEGACY_SPLIT_KEYS.map((key) => SecureStore.getItemAsync(key)),
    );
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
    return null;
  }
}

/** Newest complete legacy session, using the same ordering the old reader used. */
async function readLegacy(): Promise<AuthSession | null> {
  const [secureRaw, fallbackRaw] = await Promise.all([
    SecureStore.getItemAsync(LEGACY_SECURE_SESSION).catch(() => null),
    AsyncStorage.getItem(LEGACY_ASYNC_KEY).catch(() => null),
  ]);
  const secure = parseEnvelope(secureRaw);
  const fallback = parseEnvelope(fallbackRaw);
  lastRevision = Math.max(lastRevision, secure?.revision ?? 0, fallback?.revision ?? 0);
  // A legacy fallback has revision zero and wins over potentially mixed split keys.
  const newest = secure && (!fallback || (secure.revision ?? 0) >= (fallback.revision ?? 0))
    ? secure : fallback;
  return newest ? sessionFrom(newest) : readLegacySplit();
}

async function deleteLegacy(): Promise<void> {
  await Promise.all([
    ...[LEGACY_SECURE_SESSION, ...LEGACY_SPLIT_KEYS].map((key) =>
      SecureStore.deleteItemAsync(key).catch(() => undefined)),
    AsyncStorage.removeItem(LEGACY_ASYNC_KEY).catch(() => undefined),
  ]);
}

/** Writes the keychain envelope and confirms it reads back intact. */
async function writeSecure(session: AuthSession): Promise<boolean> {
  lastRevision = Math.max(lastRevision + 1, Date.now());
  const envelope = JSON.stringify({ ...session, v: SCHEMA, revision: lastRevision });
  try {
    // One write keeps the access and refresh tokens from the same rotation.
    await SecureStore.setItemAsync(KEY_SESSION, envelope, SECURE_OPTIONS);
    return (await readSecure(KEY_SESSION)) === envelope;
  } catch {
    return false;
  }
}

export function loadAuthSession(): Promise<AuthSession | null> {
  return serialized(async () => {
    const current = parseEnvelope(await readSecure(KEY_SESSION));
    if (current) {
      lastRevision = Math.max(lastRevision, current.revision ?? 0);
      // An earlier migration may have been interrupted before its cleanup.
      await deleteLegacy();
      return sessionFrom(current);
    }
    const legacy = await readLegacy();
    if (!legacy) return null;
    if (await writeSecure(legacy)) {
      await deleteLegacy();
      debugLog('auth', 'legacy session migrated to keychain');
    } else {
      // Keep the pre-existing copy so the next launch can retry; nothing new
      // is written in plaintext. The session still works for this run.
      debugLog('auth', 'legacy session migration failed — will retry');
    }
    return legacy;
  });
}

export function saveAuthSession(session: AuthSession): Promise<void> {
  // Snapshot caller-owned data before waiting behind an earlier storage operation.
  const snapshot = { ...session };
  return serialized(async () => {
    const saved = await writeSecure(snapshot);
    // Legacy copies hold an older rotation either way. When the keychain is
    // unavailable the session lives in memory only and the next cold boot
    // asks the user to sign in — never a plaintext fallback.
    await deleteLegacy();
    if (!saved) debugLog('auth', 'saveAuthSession keychain write failed — session kept in memory only');
  });
}

export function clearAuthSession(): Promise<void> {
  return serialized(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_SESSION, SECURE_OPTIONS).catch(() => undefined),
      deleteLegacy(),
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
