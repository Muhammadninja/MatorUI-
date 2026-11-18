/**
 * A Garage vehicle's picture as the backend reports it: the `vehicle_image` field
 * of `GET/POST /v1/garage/vehicles[/:id]` and of `GET /v1/garage/vehicles/:id/image`
 * (`{ vehicle_id, vehicle_image }`).
 *
 *   pending      the backend has asked the Vehicle Image Pipeline for it → "preparing"
 *   approved     published; `url` is the public image → the image itself
 *   unavailable  none to come for now (failed, rejected, under review, not requested)
 *                → "no image yet"
 *
 * The app only reads this. It never starts or retries a generation.
 */
export type VehicleImageStatus = 'pending' | 'approved' | 'unavailable';
/**
 * Why a `pending` image is not there yet: `processing` (a job prepares a
 * candidate) or `awaiting_review` (a person checks a candidate, or supplies one).
 */
export type VehicleImageStage = 'processing' | 'awaiting_review';

export type VehicleImageState = {
  status: VehicleImageStatus;
  /** Only while `pending`; absent from older backends. */
  stage?: VehicleImageStage;
  /** Published HTTPS URL; null for a bundled catalog asset. */
  url: string | null;
  version: number | null;
  /** Bundled catalog key for an approved asset that does not need publication. */
  catalogAssetKey?: string | null;
  attribution?: string;
  author?: string;
  license?: string;
  licenseUrl?: string;
  sourcePage?: string;
  sourceTitle?: string;
  modifications?: string;
  reason?: 'not_requested' | 'needs_review' | 'generation_failed' | 'rejected' | 'request_failed' | null;
};

const STATUSES: readonly string[] = ['pending', 'approved', 'unavailable'];

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('https://')) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate the backend's `vehicle_image`. Missing or malformed → undefined (older
 * backend: the card keeps its existing behaviour). `approved` without a usable HTTPS
 * URL needs a catalog key; otherwise it is shown as pending, never as a broken image.
 */
export function parseVehicleImage(raw: unknown): VehicleImageState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.status !== 'string' || !STATUSES.includes(r.status)) return undefined;
  const version = Number.isInteger(r.version) && (r.version as number) > 0 ? (r.version as number) : null;
  const reason = ['not_requested', 'needs_review', 'generation_failed', 'rejected', 'request_failed'].includes(String(r.reason))
    ? r.reason as VehicleImageState['reason']
    : null;
  if (r.status === 'approved') {
    if (isHttpsUrl(r.url)) return { status: 'approved', url: r.url, version,
      ...(typeof r.attribution === 'string' ? { attribution: r.attribution.slice(0, 1000) } : {}),
      ...(typeof r.author === 'string' ? { author: r.author.slice(0, 500) } : {}),
      ...(typeof r.license === 'string' ? { license: r.license.slice(0, 80) } : {}),
      ...(isHttpsUrl(r.license_url) ? { licenseUrl: r.license_url } : {}),
      ...(isHttpsUrl(r.source_page) ? { sourcePage: r.source_page } : {}),
      ...(typeof r.source_title === 'string' ? { sourceTitle: r.source_title.slice(0, 500) } : {}),
      ...(typeof r.modifications === 'string' ? { modifications: r.modifications.slice(0, 500) } : {}),
      ...(reason ? { reason } : {}) };
    if (typeof r.catalog_asset_key === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.catalog_asset_key)) {
      return { status: 'approved', url: null, version, catalogAssetKey: r.catalog_asset_key, reason };
    }
    return { status: 'pending', url: null, version: null };
  }
  if (r.status === 'pending') {
    const stage = r.stage === 'processing' || r.stage === 'awaiting_review' ? r.stage : null;
    return { status: 'pending', url: null, version: null, ...(stage ? { stage } : {}) };
  }
  return { status: r.status as VehicleImageStatus, url: null, version: null, ...(reason ? { reason } : {}) };
}

/** The approved image's URL, or null. */
export function approvedImageUrl(state: VehicleImageState | null | undefined): string | null {
  return state?.status === 'approved' && state.url ? state.url : null;
}

/**
 * Mator 1.0 ships with the image pipeline frozen (publication off), so a pending
 * image may never arrive: the placeholder promises nothing and always says "No
 * image yet". Set to true once the pipeline publishes, to restore the
 * "being prepared" / "being checked" messages.
 */
export const PIPELINE_PROGRESS_MESSAGES = false;

/**
 * What the placeholder says. Never a time, never a technical reason; while the
 * pipeline is frozen, never a promise either.
 */
export function placeholderMessageKey(
  status: VehicleImageStatus | null | undefined,
  stage?: VehicleImageStage | null,
  progressMessages: boolean = PIPELINE_PROGRESS_MESSAGES,
): string {
  if (status === 'unavailable' || !progressMessages) return 'vehicleImage.unavailable';
  return stage === 'awaiting_review' ? 'vehicleImage.awaitingReview' : 'vehicleImage.preparing';
}

/**
 * Delays between status refreshes while an image is `pending`: 30 s, 1, 2, 5 and
 * 10 minutes, then none until the screen is opened again. Approval needs a person,
 * so a long wait is normal; the list and get responses also carry the field.
 */
export const IMAGE_STATUS_POLL_DELAYS_MS: readonly number[] = [
  30_000,
  60_000,
  120_000,
  300_000,
  600_000,
];

/** Delay before the next refresh after `pollsDone` refreshes, or false to stop. */
export function nextImagePollDelay(pollsDone: number): number | false {
  return IMAGE_STATUS_POLL_DELAYS_MS[pollsDone] ?? false;
}
