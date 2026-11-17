import { Stack } from 'expo-router';

import LegalDocumentScreen from '@/components/screens/legal-document-screen';

/**
 * The Refund & Returns Policy text on its own screen.
 *
 * Pushed from the return conditions screen (/return-policy), which shows only a
 * link to it. Root-hosted next to /return-policy so Back pops straight to the
 * return screen with the chosen product and order still in place.
 *
 * Public: the policy is published without a session.
 */
export default function RefundPolicyRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <LegalDocumentScreen type="REFUND_POLICY" fallbackHref="/return-policy" />
    </>
  );
}
