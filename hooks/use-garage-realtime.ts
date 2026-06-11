import { useEffect, useRef, useState } from 'react';

import {
  garageRealtime,
  type ConnectionState,
  type GarageRealtimeConfig,
} from '@/services/garage-realtime';
import type { GarageSocketEvent } from '@/services/garage-service';

/**
 * Subscribes the calling screen to the garage realtime channel. Events
 * are NOT delivered to the consumer directly — they're applied to the
 * garage cache by the transport layer, so the component re-renders
 * through its existing `useGarage()` subscription. The `onEvent`
 * callback (optional) lets the screen react to specific events for
 * side effects beyond cache mutation — e.g. play a haptic when a
 * mechanic broadcasts a new status, or scroll the detail screen into
 * view on a `vehicle.status.updated` for this vehicle.
 *
 * The hook is idempotent — mounting many copies (e.g. one per detail
 * screen) shares a single underlying socket. The connection lifecycle
 * is reference-counted: the first subscriber starts the client, the
 * last unsubscriber stops it.
 */

export type UseGarageRealtimeOptions = {
  /**
   * When `enabled` is false, the hook neither subscribes nor connects.
   * Lets the consumer turn off realtime cleanly (offline mode,
   * background app state, etc.) without unmounting the host screen.
   */
  enabled?: boolean;
  /** Vehicle id to filter callbacks by. When set, `onEvent` only
   *  fires for events that target this vehicle (createrd/updated/
   *  deleted with matching `vehicleId`, status updates, etc.). The
   *  cache application still happens for ALL events globally — this
   *  is a callback filter only. */
  vehicleIdFilter?: string;
  onEvent?: (event: GarageSocketEvent) => void;
  /** Initial config, applied to the underlying client. Once set,
   *  subsequent hook mounts CAN supply a different config — but it's
   *  only applied if the client isn't already running (so a config
   *  swap requires `garageRealtime.stop()` first). */
  config?: GarageRealtimeConfig;
};

export type UseGarageRealtimeValue = {
  connectionState: ConnectionState;
};

let activeSubscribers = 0;

export function useGarageRealtime(
  options: UseGarageRealtimeOptions = {},
): UseGarageRealtimeValue {
  const { enabled = true, vehicleIdFilter, onEvent, config } = options;
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    garageRealtime.getState(),
  );
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Apply configuration before the first start. Safe to call on every
  // render — `configure` just overwrites a single field.
  useEffect(() => {
    if (config) garageRealtime.configure(config);
  }, [config]);

  // Connection-state mirror so the calling screen can render a
  // "reconnecting…" pill if it wants.
  useEffect(() => {
    return garageRealtime.onConnectionStateChange(setConnectionState);
  }, []);

  // Ref-counted start/stop. The first subscriber boots the socket;
  // when the last consumer unmounts, we shut it down so the JS engine
  // and battery aren't burning on an unobserved channel.
  useEffect(() => {
    if (!enabled) return;
    activeSubscribers += 1;
    if (activeSubscribers === 1) {
      garageRealtime.start();
    }
    return () => {
      activeSubscribers = Math.max(0, activeSubscribers - 1);
      if (activeSubscribers === 0) {
        garageRealtime.stop();
      }
    };
  }, [enabled]);

  // Event callback fan-out. Uses a stable ref so changing the
  // callback per render doesn't churn subscriptions.
  useEffect(() => {
    if (!enabled) return;
    return garageRealtime.subscribe((event) => {
      const cb = onEventRef.current;
      if (!cb) return;
      if (vehicleIdFilter) {
        const matchesVehicle = event.vehicleId === vehicleIdFilter ||
          event.vehicle?.id === vehicleIdFilter;
        if (!matchesVehicle) return;
      }
      cb(event);
    });
  }, [enabled, vehicleIdFilter]);

  return { connectionState };
}

export default useGarageRealtime;
