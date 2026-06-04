import { Stack } from 'expo-router';

import CheckoutScreen from '@/components/screens/checkout-screen';

export default function CheckoutRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CheckoutScreen />
    </>
  );
}
