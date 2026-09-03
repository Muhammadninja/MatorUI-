import { Stack } from 'expo-router';

import LegalDocumentScreen from '@/components/screens/legal-document-screen';

export default function PrivacyRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LegalDocumentScreen type="PRIVACY_POLICY" />
    </>
  );
}
