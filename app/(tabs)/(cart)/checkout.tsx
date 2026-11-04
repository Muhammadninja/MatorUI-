import { Stack } from 'expo-router';

import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';

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
      <AuthenticatedRoute titleKey="checkout.title" fallbackHref="/cart">
        <CheckoutScreen />
      </AuthenticatedRoute>
    </>
  );
}
