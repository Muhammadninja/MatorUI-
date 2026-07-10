/**
 * Avatar upload service.
 *
 * Picks an image off the device, uploads it to the backend, and returns
 * the URL to store on the user profile. Follows the same swap-by-injection
 * transport pattern as `garage-api.ts` / `orders-api.ts`: implement the
 * `AvatarTransport` interface once for HTTP, replace the singleton, done.
 *
 * Wire to real API:
 *   1. Implement `HttpAvatarTransport` (commented stub below) against the
 *      backend's `POST /v1/me/avatar` (multipart/form-data).
 *   2. Replace `avatarTransport` export with the HTTP impl.
 *   3. Nothing in the UI changes — callers go through `uploadAvatar()`.
 */

/** Local file URI returned by the image picker. */
export type LocalImageUri = string;

export interface AvatarTransport {
  /**
   * Upload the image at `uri` and return the public URL the backend will
   * serve it from. `signal` lets callers cancel a slow upload (e.g. the
   * user backed off the edit screen mid-upload).
   */
  upload(uri: LocalImageUri, signal?: AbortSignal): Promise<string>;
}

// ── Mock transport ─────────────────────────────────────────────────────
// Returns the local URI itself after a short delay, simulating a network
// round-trip. Good enough for the UI to feel real until the backend lands.

class MockAvatarTransport implements AvatarTransport {
  async upload(uri: LocalImageUri, signal?: AbortSignal): Promise<string> {
    await delay(700, signal);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // In a real backend the URL would be CDN-served; mock just echoes the
    // local file URI so the avatar circle can render it immediately.
    return uri;
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort);
  });
}

// ── HTTP transport ──────────────────────────────────────────────────────
//
// Avatar upload is multipart/form-data — apiClient is JSON-only, so this
// transport talks to fetch directly, but still reads the base URL + token
// through `config/api.ts` so auth stays consistent.

import { getApiBaseUrl, getAuthToken, shouldUseHttpTransport } from '@/config/api';

export class HttpAvatarTransport implements AvatarTransport {
  async upload(uri: LocalImageUri, signal?: AbortSignal): Promise<string> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) throw new Error('No API base URL configured for avatar upload.');
    const token = await getAuthToken();

    const form = new FormData();
    form.append('avatar', {
      uri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    const res = await fetch(`${baseUrl}/v1/me/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
      signal,
    });
    if (!res.ok) throw new Error(`Avatar upload failed: ${res.status}`);
    const json = (await res.json()) as { url: string };
    return json.url;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

export const avatarTransport: AvatarTransport = shouldUseHttpTransport('avatar')
  ? new HttpAvatarTransport()
  : new MockAvatarTransport();

/** Convenience facade so call sites don't need to import the singleton. */
export function uploadAvatar(uri: LocalImageUri, signal?: AbortSignal): Promise<string> {
  return avatarTransport.upload(uri, signal);
}
