import { useQuery } from '@tanstack/react-query';

import { ordersTransport } from '@/services/orders-api';

/**
 * Where couriers go, as the backend enforces it: the box to open the map on, and the area
 * itself, to tell a buyer on the map when a point is outside it. The backend still decides on
 * saving and on quoting, and the map works without this.
 */
export function useDeliveryCoverage() {
  const query = useQuery({
    queryKey: ['shipping', 'coverage'],
    queryFn: ({ signal }) => ordersTransport.getDeliveryCoverage(signal),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  return { bounds: query.data?.bounds ?? null, polygons: query.data?.polygons ?? null };
}
