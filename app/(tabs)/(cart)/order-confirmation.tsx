import { Stack } from 'expo-router';

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
      <OrderConfirmationScreen />
    </>
  );
}
