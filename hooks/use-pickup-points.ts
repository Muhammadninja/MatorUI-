import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ordersTransport } from '@/services/orders-api';
import type { PickupPoint } from '@/services/orders-service';

export type PickupPointsState = 'idle' | 'loading' | 'success' | 'error';

export type UsePickupPointsValue = {
  state: PickupPointsState;
  points: PickupPoint[];
  refresh: () => void;
};

/**
 * Where the buyer collects each dealer's goods, for the cart as it stands on the server. Asked
 * only while the buyer collects the order: `cartKey` is null otherwise, and names the cart's
 * lines and quantities, so a changed cart asks again. Read afresh on opening the checkout,
 * since a dealer's place can change. Nothing about it is priced.
 */
export function usePickupPoints(cartKey: string | null): UsePickupPointsValue {
  const query = useQuery({
    queryKey: ['shipping', 'pickup-points', cartKey ?? 'disabled'],
    queryFn: ({ signal }) => ordersTransport.getPickupPoints(signal),
    enabled: cartKey !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  return useMemo<UsePickupPointsValue>(
    () => ({
      state:
        cartKey === null ? 'idle' : query.data ? 'success' : query.isError ? 'error' : 'loading',
      points: query.data ?? [],
      refresh: () => {
        if (cartKey !== null) void query.refetch();
      },
    }),
    [cartKey, query],
  );
}
