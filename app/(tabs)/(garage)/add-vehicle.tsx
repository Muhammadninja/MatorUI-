import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';
import AddVehicleScreen from '@/components/screens/add-vehicle-screen';

export default function AddVehicleRoute() {
  return (
    <AuthenticatedRoute titleKey="addVehicle.title" fallbackHref="/garage">
      <AddVehicleScreen />
    </AuthenticatedRoute>
  );
}
