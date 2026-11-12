import { Stack } from 'expo-router';

import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';

import OrderConfirmationScreen from '@/components/screens/order-confirmation-screen';

export default function OrderConfirmationRoute() {
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
      <AuthenticatedRoute titleKey="orderConfirmation.orderPlaced" fallbackHref="/cart">
        <OrderConfirmationScreen />
      </AuthenticatedRoute>
    </>
  );
}
