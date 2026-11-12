import { useQuery } from '@tanstack/react-query';

import { fetchVehicleImage } from '@/services/garage-api';
import {
  nextImagePollDelay,
  type VehicleImageState,
} from '@/services/vehicle-images/image-status';

/**
 * The vehicle's image state: the one the garage row carries, refreshed through
 * `GET /v1/garage/vehicles/:id/image` only while it is `pending`, on a backing-off
 * schedule that stops (see IMAGE_STATUS_POLL_DELAYS_MS). Failed refreshes count
 * toward that schedule, so an outage never turns into fast polling. Nothing here
 * blocks the card: until a refresh answers, the row's own state is shown.
 */
export function useVehicleImage(
  vehicleId: string | null | undefined,
  initial: VehicleImageState | null | undefined,
): VehicleImageState | undefined {
  const pending = initial?.status === 'pending';
  const query = useQuery({
    queryKey: ['vehicle-image', vehicleId],
    queryFn: ({ signal }) => fetchVehicleImage(vehicleId as string, signal),
    enabled: !!vehicleId && pending,
    staleTime: 0,
    retry: false,
    refetchInterval: (q) => {
      if (q.state.data && q.state.data.status !== 'pending') return false;
      return nextImagePollDelay(q.state.dataUpdateCount + q.state.errorUpdateCount - 1);
    },
  });
  return (pending ? query.data : undefined) ?? initial ?? undefined;
}
