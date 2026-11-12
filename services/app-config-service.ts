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
 *     android_store_url?: "https://play.google.com/store/apps/details?id=com.mator.myapp",
 *     support?: { phone, email, telegram_username }   // each nullable
 *   }
 * Public read (no auth). Until it exists it 404s → fetchAppConfig returns null →
 * no update is ever forced (FAIL-OPEN), so shipping the UI today is safe.
 */

import { apiClient } from '@/services/api-client';

export type SupportContacts = {
  /** E.164 ("+998502030318"), for a `tel:` link. */
  phone: string | null;
  email: string | null;
  /** Without "@" ("Mator_AutoParts"), for a t.me link. */
  telegramUsername: string | null;
};

export type AppConfig = {
  minSupportedVersion: string | null;
  latestVersion: string | null;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
  /** Where a buyer reaches a person (returns, refunds). Every channel null when
   *  the backend configures none or is older than the `support` block. */
  support: SupportContacts;
};

type RawAppConfig = {
  min_supported_version?: string | null;
  latest_version?: string | null;
  ios_store_url?: string | null;
  android_store_url?: string | null;
  support?: {
    phone?: unknown;
    email?: unknown;
    telegram_username?: unknown;
  } | null;
};

const PHONE_PATTERN = /^\+[0-9]{9,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEGRAM_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** A value from the server only when it is the shape a link can be built from. */
function valid(value: unknown, pattern: RegExp): string | null {
  return typeof value === 'string' && pattern.test(value) ? value : null;
}

/** The `support` block, checked: these values become `tel:`, `mailto:` and
 *  t.me links, so anything malformed is dropped rather than opened. */
export function parseSupportContacts(raw: RawAppConfig['support']): SupportContacts {
  return {
    phone: valid(raw?.phone, PHONE_PATTERN),
    email: valid(raw?.email, EMAIL_PATTERN),
    telegramUsername: valid(raw?.telegram_username, TELEGRAM_USERNAME_PATTERN),
  };
}

export async function fetchAppConfig(signal?: AbortSignal): Promise<AppConfig | null> {
  try {
    const r = await apiClient.get<RawAppConfig>('/v1/app/config', { signal });
    return {
      minSupportedVersion: r.min_supported_version ?? null,
      latestVersion: r.latest_version ?? null,
      iosStoreUrl: r.ios_store_url ?? null,
      androidStoreUrl: r.android_store_url ?? null,
      support: parseSupportContacts(r.support),
    };
  } catch {
    // Endpoint absent / unreachable / running on mocks → never force an update.
    return null;
  }
}
