/**
 * Where the buyer collects the order, dealer by dealer, as the backend answers
 * `GET /v1/shipping/pickup-points`. Read defensively, because a point the app draws has to
 * be a real one: a location that is not a pair of real coordinates is no location, and is
 * never replaced by another. Nothing here adds a dealer, an address or a point the backend
 * did not state.
 */
import type { DeliveryPoint, OrderPickupPoint, PickupPoint } from '@/services/orders-service';

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

function parseOrderItem(raw: unknown): OrderPickupPoint['items'] {
  if (!isObject(raw)) return [];
  const id = text(raw.order_item_id);
  const title = text(raw.title);
  const quantity = raw.quantity;
  if (!id || !title) return [];
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return [];
  return [{ id, partId: text(raw.part_id), title, quantity }];
}

/**
 * A placed pickup order's `pickup_points` (`GET /v1/orders/:id`): the same rules as the
 * cart's, keyed by order line. Null when the backend sent no list at all, so a backend
 * that does not state them yet reads as "not known" rather than "nowhere".
 */
export function parseOrderPickupPoints(raw: unknown): OrderPickupPoint[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((entry): OrderPickupPoint[] => {
    if (!isObject(entry)) return [];
    const point = entry as RawPickupPoint;
    const items = Array.isArray(point.items) ? point.items.flatMap(parseOrderItem) : [];
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

/** A pin worth showing: real coordinates, not the 0,0 a missing value often becomes. */
export function isUsableLocation(point: DeliveryPoint | null | undefined): point is DeliveryPoint {
  return (
    !!point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180 &&
    !(point.lat === 0 && point.lng === 0)
  );
}

/** The phone's own maps app at this pin: Apple Maps on iOS, any geo: handler on Android. */
export function pickupMapUrl(point: DeliveryPoint, label: string | null, os: string): string {
  const ll = `${point.lat},${point.lng}`;
  const name = encodeURIComponent(label ?? ll);
  return os === 'ios' ? `https://maps.apple.com/?ll=${ll}&q=${name}` : `geo:${ll}?q=${ll}(${name})`;
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

/** One pickup place's share of the order, for the order's item list. */
export type PickupGroup<T> = { key: string; point: PickupPoint | null; lines: T[] };

/**
 * The order's lines grouped by where each is collected, in the backend's order of places.
 * Only worth it for more than one place: otherwise null, and the list stays flat. A line
 * no place claims is kept, in a last group with no place, so nothing goes missing.
 */
export function groupLinesByPickup<T extends { id: string }>(
  lines: T[],
  points: PickupPoint[],
): PickupGroup<T>[] | null {
  if (points.length < 2) return null;
  const claimed = new Set<string>();
  const groups: PickupGroup<T>[] = points.map((point, index) => {
    const ids = new Set(point.items.flatMap((item) => [item.cartItemId, item.partId].filter(Boolean) as string[]));
    const mine = lines.filter((line) => ids.has(line.id) && !claimed.has(line.id));
    mine.forEach((line) => claimed.add(line.id));
    return { key: point.dealerId ?? `place_${index}`, point, lines: mine };
  });
  const rest = lines.filter((line) => !claimed.has(line.id));
  if (rest.length > 0) groups.push({ key: 'unassigned', point: null, lines: rest });
  return groups.filter((group) => group.lines.length > 0);
}
