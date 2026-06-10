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

const KEY = 'auth:v1';
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
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed) || parsed.v !== SCHEMA) return null;
    const { v: _v, ...session } = parsed;
    return session;
  } catch {
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  try {
    const envelope: Envelope = { v: SCHEMA, ...session };
    await SecureStore.setItemAsync(KEY, JSON.stringify(envelope));
  } catch {
    // Silent — failing to persist isn't fatal for the current session.
    // The user just won't survive a cold boot. Surface this via Sentry
    // once we have a meaningful breadcrumb story.
  }
}

export async function clearAuthSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Silent — same reason as save.
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
