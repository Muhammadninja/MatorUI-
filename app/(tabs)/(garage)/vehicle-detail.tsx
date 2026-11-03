import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';
import VehicleDetailScreen from '@/components/screens/vehicle-detail-screen';

export default function VehicleDetailRoute() {
  return (
    <AuthenticatedRoute titleKey="garage.vehicleDetails" fallbackHref="/garage">
      <VehicleDetailScreen />
    </AuthenticatedRoute>
  );
}
