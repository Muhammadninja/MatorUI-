import { Stack } from 'expo-router';

import CheckoutScreen from '@/components/screens/checkout-screen';

export default function CheckoutRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <CheckoutScreen />
    </>
  );
}
