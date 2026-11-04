import type { NotificationItem } from '@/services/notifications-service';

/**
 * Where a tapped notification goes, or null when it has nowhere real to go.
 *
 * Notifications sits on the root stack, so every destination has to as well. A
 * push into a tab's stack doesn't animate, leaves that tab stuck on the pushed
 * screen, and Back can't return to the feed. The backend's own links name tab
 * routes, which are either replaced here or don't exist in this app.
 */
export function notificationDestination(
  n: NotificationItem,
  vehicleInGarage: boolean,
): string | null {
  if (n.type === 'vehicle_status_updated') {
    return vehicleInGarage && n.vehicleId
      ? `/notification-vehicle?id=${encodeURIComponent(n.vehicleId)}`
      : null;
  }
  if (n.orderId) return `/track-order?orderId=${encodeURIComponent(n.orderId)}`;
  if (!n.deeplinkPath || n.deeplinkPath.startsWith('/(tabs)')) return null;
  return n.deeplinkPath;
}
