import { approvedImageUrl, type VehicleImageState, type VehicleImageStatus } from './image-status';
import type { VehicleImageSource } from './manifest';
import type { VehicleImageResolution } from './resolver';

/** What a vehicle's 2:1 car slot shows. */
export type VehicleVisual =
  | { kind: 'image'; source: VehicleImageSource }
  | { kind: 'placeholder'; status?: VehicleImageStatus | null };

/**
 * The picture for a Garage vehicle, in this order:
 *   1. the backend's approved, published image (`vehicle_image.url`);
 *   2. the bundled, approved manifest image for this exact model (unchanged behaviour);
 *   3. the existing placeholder, saying "preparing" (pending, or status unknown) or
 *      "no image yet" (unavailable).
 */
export function chooseVehicleVisual(
  bundled: VehicleImageResolution,
  image: VehicleImageState | null | undefined,
): VehicleVisual {
  const url = approvedImageUrl(image);
  if (url) return { kind: 'image', source: { uri: url } };
  if (bundled.kind === 'image') return { kind: 'image', source: bundled.source };
  return image ? { kind: 'placeholder', status: image.status } : { kind: 'placeholder' };
}
