/**
 * The delivery area as the backend sends it, and the same test it applies to it: a point on
 * the boundary, including a hole's, counts as inside. This only tells the buyer early, on the
 * map. The backend checks again on saving and on quoting, and its answer is the one that counts.
 */
import type { DeliveryPoint } from '@/services/orders-service';

/** GeoJSON positions: [longitude, latitude]. */
type Position = readonly [number, number];
type Ring = readonly Position[];
/** Each polygon is its outer boundary followed by any holes. */
export type DeliveryPolygons = readonly (readonly Ring[])[];

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function isRing(value: unknown): value is Ring {
  return Array.isArray(value) && value.length >= 4 && value.every(isPosition);
}

/**
 * The polygons of a GeoJSON MultiPolygon, or null when the answer is anything else. Null only
 * means the app cannot tell early, which leaves the decision with the backend.
 */
export function parseCoverageGeometry(geometry: unknown): DeliveryPolygons | null {
  const { type, coordinates } = (geometry ?? {}) as { type?: unknown; coordinates?: unknown };
  if (type !== 'MultiPolygon' || !Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }
  const valid = coordinates.every(
    (polygon: unknown) => Array.isArray(polygon) && polygon.length > 0 && polygon.every(isRing),
  );
  return valid ? (coordinates as DeliveryPolygons) : null;
}

function isOnSegment(point: DeliveryPoint, a: Position, b: Position): boolean {
  const cross = (b[0] - a[0]) * (point.lat - a[1]) - (b[1] - a[1]) * (point.lng - a[0]);
  return (
    cross === 0 &&
    point.lng >= Math.min(a[0], b[0]) &&
    point.lng <= Math.max(a[0], b[0]) &&
    point.lat >= Math.min(a[1], b[1]) &&
    point.lat <= Math.max(a[1], b[1])
  );
}

function ringPosition(point: DeliveryPoint, ring: Ring): 'inside' | 'edge' | 'outside' {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (isOnSegment(point, a, b)) return 'edge';
    const crosses =
      a[1] > point.lat !== b[1] > point.lat &&
      point.lng < ((b[0] - a[0]) * (point.lat - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

export function isWithinCoverage(point: DeliveryPoint, polygons: DeliveryPolygons): boolean {
  return polygons.some(([outer, ...holes]) => {
    if (!outer || ringPosition(point, outer) === 'outside') return false;
    return !holes.some((hole) => ringPosition(point, hole) === 'inside');
  });
}
