import { Stack } from 'expo-router';

import ShippingAddressesScreen from '@/components/screens/shipping-addresses-screen';

export default function ShippingAddressesRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ShippingAddressesScreen />
    </>
  );
}
