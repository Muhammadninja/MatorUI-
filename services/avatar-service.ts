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

import { debugLog } from '@/services/debug-log';

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

// ── HTTP transport ──────────────────────────────────────────────────────
//
// Avatar upload is multipart/form-data. We use `expo-file-system`'s
// `uploadAsync` (legacy API) rather than `fetch` + FormData: on Expo SDK 56 /
// the New Architecture, appending a `{ uri, name, type }` file part to FormData
// throws "Unsupported FormDataPart implementation". `uploadAsync` streams the
// file URI natively as a proper multipart part, which is the supported path.

import { getApiBaseUrl, getAuthToken } from '@/config/api';
import * as FileSystem from 'expo-file-system/legacy';

export class HttpAvatarTransport implements AvatarTransport {
  async upload(uri: LocalImageUri, signal?: AbortSignal): Promise<string> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) throw new Error('No API base URL configured for avatar upload.');
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const token = await getAuthToken();

    // Backend contract (text/backend.json → AvatarUpload): multipart/form-data,
    // field name `avatar` (verified live on api.mator.uz 2026-07-23 via
    // /docs-json — the DTO field is `avatar`, NOT `file`). Server strips EXIF +
    // NSFW-scans and returns `{ avatarUrl, avatar_url, url }`.
    debugLog('avatar', '→ POST /v1/me/avatar (uploadAsync multipart)', {
      uri,
      host: baseUrl,
      hasToken: !!token,
    });

    let res: FileSystem.FileSystemUploadResult;
    try {
      res = await FileSystem.uploadAsync(`${baseUrl}/v1/me/avatar`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'avatar',
        mimeType: 'image/jpeg',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      // A thrown upload is a transport-level failure — network reset, ATS block,
      // or the file URI not being readable. Surface it instead of a bare error.
      debugLog('avatar', '✗ uploadAsync threw (transport error)', {
        name: (err as Error)?.name,
        message: (err as Error)?.message,
      });
      throw new Error(`Avatar upload transport error: ${(err as Error)?.message ?? 'unknown'}`);
    }

    if (res.status < 200 || res.status >= 300) {
      debugLog('avatar', `✗ ${res.status} POST /v1/me/avatar`, res.body);
      throw new Error(`Avatar upload failed: ${res.status} ${res.body ?? ''}`.trim());
    }

    let json: { avatarUrl?: string; avatar_url?: string; url?: string };
    try {
      json = JSON.parse(res.body) as { avatarUrl?: string; avatar_url?: string; url?: string };
    } catch {
      debugLog('avatar', '✗ upload OK but body was not JSON', res.body);
      throw new Error('Avatar upload returned a non-JSON body.');
    }
    const url = json.avatarUrl ?? json.avatar_url ?? json.url;
    if (!url) {
      debugLog('avatar', '✗ upload OK but no avatar_url in response', json);
      throw new Error('Avatar upload returned no URL.');
    }
    debugLog('avatar', '← avatar_url', url);
    return url;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

export const avatarTransport: AvatarTransport = new HttpAvatarTransport();

/** Convenience facade so call sites don't need to import the singleton. */
export function uploadAvatar(uri: LocalImageUri, signal?: AbortSignal): Promise<string> {
  return avatarTransport.upload(uri, signal);
}
