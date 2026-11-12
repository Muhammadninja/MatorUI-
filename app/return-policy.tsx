import { Stack, useLocalSearchParams } from 'expo-router';

import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';
import ReturnPolicyScreen from '@/components/screens/return-policy-screen';

/**
 * Return conditions — the Refund & Returns Policy plus a way to reach support.
 *
 * Root-hosted, like track-order, because three surfaces push it: a delivered
 * order (with `orderId`), checkout and Settings → Legal. From the root stack
 * `back` returns to whichever of them opened it.
 *
 * With an `orderId` the screen reads that order, so it needs a session. Without
 * one it shows only the public policy and support contacts, and needs none.
 */
export default function ReturnPolicyRoute() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const id = typeof orderId === 'string' && orderId ? orderId : undefined;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      {id ? (
        <AuthenticatedRoute titleKey="returnPolicy.title" fallbackHref="/profile">
          <ReturnPolicyScreen orderId={id} />
        </AuthenticatedRoute>
      ) : (
        <ReturnPolicyScreen />
      )}
    </>
  );
}
