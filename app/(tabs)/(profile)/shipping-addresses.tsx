import { Stack } from 'expo-router';

import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';

import ShippingAddressesScreen from '@/components/screens/shipping-addresses-screen';

export default function ShippingAddressesRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthenticatedRoute titleKey="addresses.title" fallbackHref="/profile">
        <ShippingAddressesScreen />
      </AuthenticatedRoute>
    </>
  );
}
