import { Stack } from 'expo-router';

import TermsScreen from '@/components/screens/terms-screen';

export default function TermsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TermsScreen />
    </>
  );
}
