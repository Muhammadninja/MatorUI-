/**
 * Where the buyer collects the order, dealer by dealer, as the backend answers
 * `GET /v1/shipping/pickup-points`. Read defensively, because a point the app draws has to
 * be a real one: a location that is not a pair of real coordinates is no location, and is
 * never replaced by another. Nothing here adds a dealer, an address or a point the backend
 * did not state.
 */
import type { DeliveryPoint, PickupPoint } from '@/services/orders-service';

type RawPickupItem = {
  cart_item_id?: unknown;
  part_id?: unknown;
  title?: unknown;
  quantity?: unknown;
};

type RawPickupPoint = {
  dealer_id?: unknown;
  dealer_name?: unknown;
  address?: unknown;
  landmark?: unknown;
  location?: unknown;
  items?: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Words, or null: an empty or blank string says nothing. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** The point, when it is one: two finite numbers in range, and not 0, 0. */
export function parsePickupLocation(raw: unknown): DeliveryPoint | null {
  if (!isObject(raw)) return null;
  const { lat, lng } = raw;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function parseItem(raw: unknown): PickupPoint['items'] {
  if (!isObject(raw)) return [];
  const item = raw as RawPickupItem;
  const cartItemId = text(item.cart_item_id);
  const title = text(item.title);
  const quantity = item.quantity;
  if (!cartItemId || !title) return [];
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return [];
  return [{ cartItemId, partId: text(item.part_id), title, quantity }];
}

/** The `pickup_points` list. A dealer the app can name no line for is left out. */
export function parsePickupPoints(raw: unknown): PickupPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): PickupPoint[] => {
    if (!isObject(entry)) return [];
    const point = entry as RawPickupPoint;
    const items = Array.isArray(point.items) ? point.items.flatMap(parseItem) : [];
    if (items.length === 0) return [];
    return [
      {
        dealerId: text(point.dealer_id),
        dealerName: text(point.dealer_name),
        address: text(point.address),
        landmark: text(point.landmark),
        location: parsePickupLocation(point.location),
        items,
      },
    ];
  });
}

/**
 * What is missing from a dealer's pickup point, for the checkout to say so: the whole point,
 * only its address, or only its place on the map. Null when both are on record.
 */
export type PickupPointGap = 'not_specified' | 'no_address' | 'no_location';

export function pickupPointGap(
  point: Pick<PickupPoint, 'address' | 'location'>,
): PickupPointGap | null {
  if (!point.address && !point.location) return 'not_specified';
  if (!point.address) return 'no_address';
  if (!point.location) return 'no_location';
  return null;
}

/** Coordinates as a buyer can read them out or type them: six places, about 10 cm. */
export function formatCoordinates(point: DeliveryPoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

/** Names the cart's lines and their quantities, so a change to the cart asks again. */
export function pickupCartKey(items: readonly { id: string; quantity: number }[]): string {
  return items
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join(',');
}
