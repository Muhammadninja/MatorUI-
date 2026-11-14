import {
  approvedImageUrl,
  type VehicleImageStage,
  type VehicleImageState,
  type VehicleImageStatus,
} from './image-status';
import type { VehicleImageSource } from './manifest';
import type { VehicleImageResolution } from './resolver';

/** The backend's `identity.status` for a Garage vehicle. */
export type VehicleIdentityStatus = 'verified' | 'unverified' | 'needs_review' | 'unresolved';

/** What a vehicle's 2:1 car slot shows. */
export type VehicleVisual =
  | { kind: 'image'; source: VehicleImageSource }
  | { kind: 'placeholder'; status?: VehicleImageStatus | null; stage?: VehicleImageStage };

/** `identity.status` from the backend's Garage vehicle; undefined from an older backend. */
export function parseIdentityStatus(raw: unknown): VehicleIdentityStatus | undefined {
  const status = (raw as { status?: unknown } | null | undefined)?.status;
  return status === 'verified' || status === 'unverified' || status === 'needs_review' || status === 'unresolved'
    ? status
    : undefined;
}

/**
 * The picture for a Garage vehicle, in this order:
 *   1. the backend's approved, published image (`vehicle_image.url`);
 *   2. the bundled image the backend approved by catalog key;
 *   3. the bundled, approved manifest image for this exact model, but only
 *      where the backend has not resolved the vehicle to something the
 *      model-level bundle cannot know: an older backend, a vehicle saved before
 *      identities were resolved, or a verified identity. An unverified or
 *      ambiguous identity (e.g. a Cobalt outside its verified years) never
 *      borrows the model's picture;
 *   4. the placeholder, saying "preparing", "being checked" or "no image yet".
 */
export function chooseVehicleVisual(
  bundled: VehicleImageResolution,
  image: VehicleImageState | null | undefined,
  identityStatus?: VehicleIdentityStatus | null,
): VehicleVisual {
  const url = approvedImageUrl(image);
  if (url) return { kind: 'image', source: { uri: url } };
  if (image?.status === 'approved' && image.catalogAssetKey) {
    return bundled.kind === 'image' && bundled.bodyKey === image.catalogAssetKey
      ? { kind: 'image', source: bundled.source }
      : { kind: 'placeholder', status: 'unavailable' };
  }
  if (image?.status === 'unavailable' && (image.reason === 'rejected' || image.reason === 'needs_review'))
    return { kind: 'placeholder', status: image.status };
  const bundleMayAnswer = !identityStatus || identityStatus === 'verified' || identityStatus === 'unresolved';
  if (bundled.kind === 'image' && bundleMayAnswer) return { kind: 'image', source: bundled.source };
  if (!image) return { kind: 'placeholder' };
  return image.stage
    ? { kind: 'placeholder', status: image.status, stage: image.stage }
    : { kind: 'placeholder', status: image.status };
}
