import { Stack } from 'expo-router';

import OrderHistoryScreen from '@/components/screens/order-history-screen';

export default function OrderHistoryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OrderHistoryScreen />
    </>
  );
}
