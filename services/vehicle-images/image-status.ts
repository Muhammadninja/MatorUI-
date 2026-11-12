/**
 * Where a vehicle's picture is in the AI Vehicle Image Pipeline. The Asset
 * Registry that reports it is not connected yet: until it is, a vehicle with no
 * approved image in the bundled manifest has no known status, and the card treats
 * it as being prepared, which is what the pipeline does for every such vehicle.
 *
 * The app only reads this. It never starts a generation.
 */
export type VehicleImageStatus =
  /** An approved image is published. */
  | 'approved'
  /** Waiting for its turn in the generation queue. */
  | 'queued'
  /** Being generated. */
  | 'generating'
  /** Generated, waiting for an administrator's approval. */
  | 'pending_review'
  /** Generation failed. */
  | 'failed'
  /** No image and none expected, or the registry could not say. */
  | 'unavailable';

/** What the placeholder says: an image on its way, or simply none yet. Never a time. */
export function placeholderMessageKey(status: VehicleImageStatus | null | undefined): string {
  return status === 'failed' || status === 'unavailable'
    ? 'vehicleImage.unavailable'
    : 'vehicleImage.preparing';
}
