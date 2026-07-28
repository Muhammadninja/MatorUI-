/**
 * App remote config — the minimum supported app version used to gate a mandatory
 * update, plus store links. Must be REMOTE (a shipped build can't know a newer
 * minimum was set unless it asks the server).
 *
 * Backend contract (PROPOSED — build to ship the force-update gate):
 *   GET /v1/app/config → {
 *     min_supported_version: "1.4.0",   // builds below this MUST update
 *     latest_version?: "1.5.0",
 *     ios_store_url?: "https://apps.apple.com/app/id0000000000",
 *     android_store_url?: "https://play.google.com/store/apps/details?id=com.fotih12.mator"
 *   }
 * Public read (no auth). Until it exists it 404s → fetchAppConfig returns null →
 * no update is ever forced (FAIL-OPEN), so shipping the UI today is safe.
 */

import { apiClient } from '@/services/api-client';

export type AppConfig = {
  minSupportedVersion: string | null;
  latestVersion: string | null;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
};

type RawAppConfig = {
  min_supported_version?: string | null;
  latest_version?: string | null;
  ios_store_url?: string | null;
  android_store_url?: string | null;
};

export async function fetchAppConfig(signal?: AbortSignal): Promise<AppConfig | null> {
  try {
    const r = await apiClient.get<RawAppConfig>('/v1/app/config', { signal });
    return {
      minSupportedVersion: r.min_supported_version ?? null,
      latestVersion: r.latest_version ?? null,
      iosStoreUrl: r.ios_store_url ?? null,
      androidStoreUrl: r.android_store_url ?? null,
    };
  } catch {
    // Endpoint absent / unreachable / running on mocks → never force an update.
    return null;
  }
}
