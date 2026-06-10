/**
 * App-wide API configuration. Read by every transport (garage, catalog,
 * top-featured, search) so the swap from mock → HTTP is a single env-var
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

/** True when transports should construct their HTTP implementation. */
export function shouldUseHttpTransport(): boolean {
  return getApiBaseUrl() !== null;
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
