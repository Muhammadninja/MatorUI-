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

export type VehicleImageState = {
  status: VehicleImageStatus;
  /** Public https URL, set only when `status` is `approved`. */
  url: string | null;
  version: number | null;
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
 * backend: the card keeps its existing behaviour). `approved` without a usable https
 * URL is shown as `pending`, never as a broken image.
 */
export function parseVehicleImage(raw: unknown): VehicleImageState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.status !== 'string' || !STATUSES.includes(r.status)) return undefined;
  const version = Number.isInteger(r.version) && (r.version as number) > 0 ? (r.version as number) : null;
  if (r.status === 'approved') {
    return isHttpsUrl(r.url)
      ? { status: 'approved', url: r.url, version }
      : { status: 'pending', url: null, version: null };
  }
  return { status: r.status as VehicleImageStatus, url: null, version: null };
}

/** The approved image's URL, or null. */
export function approvedImageUrl(state: VehicleImageState | null | undefined): string | null {
  return state?.status === 'approved' && state.url ? state.url : null;
}

/** What the placeholder says: an image on its way, or simply none yet. Never a time. */
export function placeholderMessageKey(status: VehicleImageStatus | null | undefined): string {
  return status === 'unavailable' ? 'vehicleImage.unavailable' : 'vehicleImage.preparing';
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
