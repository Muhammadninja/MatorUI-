/** Credentials persist only in SecureStore. Plaintext copies from older releases
 * are consumed once during migration and deleted before a session is restored. */

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

// Read/delete only: an older release stored credentials at this key.
const ASYNC_KEY = 'auth:v2:session';

const INVALIDATED_KEY = 'auth:v4:invalidated';
const SECURE_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
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
    // so upgrading never prefers an older encrypted copy after a failed write.
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

// A non-secret tombstone prevents failed Keychain deletion from resurrecting a
// signed-out session on restart. A successful new secure save removes it last.
async function eraseCredentials(): Promise<void> {
  const marked = await AsyncStorage.setItem(INVALIDATED_KEY, '1').then(() => true, () => false);
  const results = await Promise.allSettled([
    AsyncStorage.removeItem(ASYNC_KEY),
    ...[KEY_SESSION, KEY_ACCESS, KEY_REFRESH, KEY_META].map((key) => SecureStore.deleteItemAsync(key)),
  ]);
  if (results.some((r) => r.status === 'rejected') && !marked) {
    throw new Error('Could not clear saved credentials');
  }
}

async function writeSecure(session: AuthSession): Promise<void> {
  lastRevision = Math.max(lastRevision + 1, Date.now());
  const envelope = JSON.stringify({ ...session, v: SCHEMA, revision: lastRevision });
  await SecureStore.setItemAsync(KEY_SESSION, envelope, SECURE_OPTIONS);
  // Verify persistence before accepting an account switch or migrated session.
  if (await SecureStore.getItemAsync(KEY_SESSION) !== envelope) {
    throw new Error('Could not persist credentials securely');
  }
  await AsyncStorage.removeItem(ASYNC_KEY);
  await Promise.all([KEY_ACCESS, KEY_REFRESH, KEY_META].map((key) => SecureStore.deleteItemAsync(key)));
  await AsyncStorage.removeItem(INVALIDATED_KEY);
}

export function loadAuthSession(): Promise<AuthSession | null> {
  return serialized(async () => {
    try {
      if (await AsyncStorage.getItem(INVALIDATED_KEY)) {
        await eraseCredentials();
        return null;
      }
      // A Keychain read error must not silently substitute a plaintext token.
      const secure = parseEnvelope(await SecureStore.getItemAsync(KEY_SESSION));
      const legacyRaw = await AsyncStorage.getItem(ASYNC_KEY);
      const legacy = parseEnvelope(legacyRaw);
      const newest = secure && (!legacy || (secure.revision ?? 0) >= (legacy.revision ?? 0))
        ? secure : legacy;
      lastRevision = Math.max(lastRevision, newest?.revision ?? 0);
      if (newest) {
        if (legacyRaw !== null) {
          // Commit and verify the encrypted copy before deleting the only usable
          // legacy copy. Any migration error falls through to fail-closed cleanup.
          await writeSecure(sessionFrom(newest));
        }
        return sessionFrom(newest);
      }
      await AsyncStorage.removeItem(ASYNC_KEY);
      const [accessToken, refreshToken, metaRaw] = await Promise.all([
        SecureStore.getItemAsync(KEY_ACCESS), SecureStore.getItemAsync(KEY_REFRESH), SecureStore.getItemAsync(KEY_META),
      ]);
      if (!accessToken || !refreshToken) return null;
      let expiresAt: number | undefined;
      try {
        const meta = JSON.parse(metaRaw ?? '{}') as { v?: number; expiresAt?: number };
        if (meta.v === SCHEMA && typeof meta.expiresAt === 'number') expiresAt = meta.expiresAt;
      } catch { /* Metadata is optional; the server validates the credential. */ }
      const session = { accessToken, refreshToken, ...(expiresAt !== undefined ? { expiresAt } : {}) };
      await writeSecure(session);
      return session;
    } catch {
      cachedSession = null;
      await eraseCredentials().catch(() => undefined);
      debugLog('auth', 'Secure credential restoration failed');
      return null;
    }
  });
}

export function saveAuthSession(session: AuthSession): Promise<void> {
  const snapshot = { ...session };
  return serialized(async () => {
    try {
      // Invalidate first: a crash or failed account switch cannot restore an old user.
      await AsyncStorage.setItem(INVALIDATED_KEY, '1');
      await writeSecure(snapshot);
    } catch {
      cachedSession = null;
      await eraseCredentials().catch(() => undefined);
      throw new Error('Could not persist credentials securely');
    }
  });
}

export function clearAuthSession(): Promise<void> {
  cachedSession = null;
  return serialized(eraseCredentials);
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
