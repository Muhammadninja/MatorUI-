import { Stack } from 'expo-router';

import ItemDetailScreen from '@/components/screens/item-detail-screen';

export default function ItemDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ItemDetailScreen />
    </>
  );
}
