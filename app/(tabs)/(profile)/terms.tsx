import { Stack } from 'expo-router';

import LegalDocumentScreen from '@/components/screens/legal-document-screen';

/** Kept at `/terms` (rather than renamed) so existing deep links keep working. */
export default function TermsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LegalDocumentScreen type="TERMS_OF_USE" />
    </>
  );
}
