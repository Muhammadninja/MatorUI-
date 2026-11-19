import { Stack } from 'expo-router';

import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';

import OrderConfirmationScreen from '@/components/screens/order-confirmation-screen';

/** One object for the life of the screen: Stack.Screen re-applies its options whenever they
 *  change identity, which would undo the screen turning its own exit animation off. */
const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_bottom',
  gestureEnabled: true,
  gestureDirection: 'vertical',
} as const;

export default function OrderConfirmationRoute() {
  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <AuthenticatedRoute titleKey="orderConfirmation.orderPlaced" fallbackHref="/cart">
        <OrderConfirmationScreen />
      </AuthenticatedRoute>
    </>
  );
}
