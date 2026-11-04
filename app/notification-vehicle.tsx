import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';
import VehicleDetailScreen from '@/components/screens/vehicle-detail-screen';

/**
 * The vehicle screen opened from a notification. It's on the ROOT stack, next to
 * Notifications, so Back returns to the feed and the Garage tab keeps its own
 * state. The Garage tab's own route is `(tabs)/(garage)/vehicle-detail`.
 */
export default function NotificationVehicleRoute() {
  return (
    <AuthenticatedRoute titleKey="garage.vehicleDetails" fallbackHref="/notifications">
      <VehicleDetailScreen />
    </AuthenticatedRoute>
  );
}
