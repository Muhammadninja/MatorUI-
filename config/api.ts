/**
 * App-wide API configuration. Read by every transport (garage, catalog,
 * search) so the swap from mock → HTTP is a single env-var
 * flip plus one helper rewrite for auth.
 *
 * Env contract:
 *   - `EXPO_PUBLIC_API_BASE_URL` — when set, every transport switches
 *     to its HTTP implementation. When empty / undefined, every
 *     transport stays on its mock implementation. The `EXPO_PUBLIC_`
 *     prefix is required for Expo to inline the value in production
 *     builds.
 *
 *   - Auth token: `getAuthToken()` reads from the in-memory cache in
 *     `services/auth-storage`. The auth context hydrates that cache on
 *     mount + every sign-in / refresh / sign-out.
 */

import { getCurrentSession } from '@/services/auth-storage';

/** Returns the configured API base URL, or null when running on mocks. */
export function getApiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!raw || raw.trim().length === 0) return null;
  // Strip trailing slash so transports can do `${base}/path` without
  // worrying about double-slash bugs.
  return raw.replace(/\/+$/, '');
}

/**
 * Per-domain HTTP gate. A transport uses its HTTP implementation when a
 * base URL is configured AND its domain is enabled.
 *
 * `EXPO_PUBLIC_HTTP_DOMAINS` is an optional comma-separated allowlist of
 * domain keys (e.g. "catalog,garage"). When set, ONLY those domains
 * use HTTP and every other transport stays on its mock — so endpoints can
 * be brought online one at a time as the backend seeds/verifies them,
 * instead of an all-or-nothing flip. When the var is unset/empty, the base
 * URL alone enables HTTP for every domain (the original behavior).
 *
 * `domain` is optional for back-compat; when a filter is active a call
 * that doesn't tag its domain stays on the mock (safe default).
 */
export function shouldUseHttpTransport(domain?: string): boolean {
  if (getApiBaseUrl() === null) return false;
  const raw = process.env.EXPO_PUBLIC_HTTP_DOMAINS;
  const allow = raw ? raw.split(',').map((d) => d.trim()).filter(Boolean) : [];
  if (allow.length === 0) return true; // no filter → every domain uses HTTP
  return domain ? allow.includes(domain) : false;
}

/**
 * Resolves the current bearer token. Reads from the in-memory session
 * cache populated by the auth context — does NOT hit SecureStore on
 * every call (that would add ~5ms per HTTP request).
 *
 * Returns `null` when no one is signed in. The HTTP client's
 * `request<T>()` helper omits the `Authorization` header when null,
 * letting public endpoints (catalog, etc.) still resolve.
 */
export async function getAuthToken(): Promise<string | null> {
  return getCurrentSession()?.accessToken ?? null;
}
