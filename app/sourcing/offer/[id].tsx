import { Stack } from 'expo-router';

import SourcingOfferScreen from '@/components/screens/sourcing-offer-screen';

/**
 * Offer detail, reached from a "found part" notification's deep link
 * (`/sourcing/offer/<id>`). Mounted on the ROOT stack so the back action
 * returns to wherever the tap came from (the notifications feed, or an OS push).
 */
export default function SourcingOfferRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <SourcingOfferScreen />
    </>
  );
}
