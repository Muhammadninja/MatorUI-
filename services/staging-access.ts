/**
 * Staging access token — the per-tester credential that gets an app request
 * past the staging proxy (api.staging.mator.uz) without touching the app's own
 * `Authorization: Bearer` header.
 *
 * Why not Basic Auth: Nginx `auth_basic` reads the same `Authorization` header
 * the API needs for the JWT, so a request can carry one or the other, never
 * both. Instead the proxy also accepts a separate header,
 * `X-Mator-Staging-Access`, checked against a revocable list of per-tester
 * tokens (see docs/staging/ios-staging.md). Browsers keep using Basic Auth.
 *
 * The token is never bundled: a tester types it once on the device, it lives in
 * the keychain (this device only, no backup), and it is never logged. Outside
 * the staging environment every function here is inert, so production
 * requests are byte-for-byte unchanged.
 */

import * as SecureStore from 'expo-secure-store';

import { getAppEnvironment } from '@/config/environment';

export const STAGING_ACCESS_HEADER = 'X-Mator-Staging-Access';
const KEY = 'mator_staging_access_v1';
/** What `openssl rand -hex 32` (or base64url) produces; rejects pasted junk. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32,128}$/;

let token: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function isStagingBuild(): boolean {
  return getAppEnvironment().name === 'staging';
}

export function isValidStagingAccessToken(value: string): boolean {
  return TOKEN_SHAPE.test(value);
}

export function hasStagingAccess(): boolean {
  return !isStagingBuild() || token !== null;
}

/** Headers to add to every request to the API host. Empty outside staging. */
export function stagingAccessHeaders(): Record<string, string> {
  return isStagingBuild() && token ? { [STAGING_ACCESS_HEADER]: token } : {};
}

export function subscribeStagingAccess(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Reads the saved token. Resolves true when requests can proceed. */
export async function loadStagingAccess(): Promise<boolean> {
  if (!isStagingBuild()) return true;
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    token = saved && isValidStagingAccessToken(saved) ? saved : null;
  } catch {
    token = null;
  }
  notify();
  return token !== null;
}

export async function saveStagingAccess(value: string): Promise<void> {
  const trimmed = value.trim();
  if (!isStagingBuild() || !isValidStagingAccessToken(trimmed)) {
    throw new Error('Invalid staging access token.');
  }
  await SecureStore.setItemAsync(KEY, trimmed, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  token = trimmed;
  notify();
}

export async function clearStagingAccess(): Promise<void> {
  token = null;
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
  notify();
}

/**
 * True when a response came from the staging proxy refusing the request, not
 * from the API: the proxy answers 401 with a Basic challenge, the API never
 * does. Such a 401 says nothing about the user's session, so it must not
 * trigger a token refresh or a sign-out.
 */
export function isStagingGateRejection(status: number, wwwAuthenticate: string | null): boolean {
  return isStagingBuild() && status === 401 && /^\s*basic\b/i.test(wwwAuthenticate ?? '');
}

/** The proxy refused the saved token (revoked or mistyped): ask for a new one. */
export function reportStagingAccessRejected(): void {
  if (!isStagingBuild() || token === null) return;
  void clearStagingAccess();
}

export type StagingAccessCheck = 'ok' | 'denied' | 'unreachable';

/** Tries a candidate token against the proxy before saving it. */
export async function verifyStagingAccess(candidate: string, timeoutMs = 10_000): Promise<StagingAccessCheck> {
  const trimmed = candidate.trim();
  if (!isStagingBuild() || !isValidStagingAccessToken(trimmed)) return 'denied';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getAppEnvironment().apiBaseUrl.replace(/\/+$/, '')}/health`, {
      headers: { Accept: 'application/json', [STAGING_ACCESS_HEADER]: trimmed },
      signal: controller.signal,
    });
    if (res.ok) return 'ok';
    return res.status === 401 || res.status === 403 ? 'denied' : 'unreachable';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}
