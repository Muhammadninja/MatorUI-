import { Stack } from 'expo-router';

import ItemDetailScreen from '@/components/screens/item-detail-screen';
import AppErrorBoundary from '@/components/shared/app-error-boundary';

export default function ItemDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AppErrorBoundary label="this product">
        <ItemDetailScreen />
      </AppErrorBoundary>
    </>
  );
}
