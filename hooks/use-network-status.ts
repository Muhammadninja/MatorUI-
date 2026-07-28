import type { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Reactive connectivity via `@react-native-community/netinfo`.
 *
 * NetInfo is a NATIVE module — it only exists in a build that linked it. In an
 * older dev client (before the rebuild that adds it) the native side is null and
 * importing eagerly throws at load, crashing the whole app. So we require it
 * GUARDED and degrade to "online" (never block) until the next rebuild picks it
 * up. After the rebuild, offline detection is fully live with no code change.
 *
 * "Offline" is only reported when we're confident — not connected, OR connected
 * but the internet is explicitly unreachable. `null` (unknown) is treated as
 * ONLINE to avoid a false offline sheet over a working connection.
 */
type NetInfoModule = typeof import('@react-native-community/netinfo').default;

let NetInfo: NetInfoModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  NetInfo = require('@react-native-community/netinfo').default as NetInfoModule;
} catch {
  NetInfo = null;
}

export function useNetworkStatus(): { isOffline: boolean; recheck: () => void } {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!NetInfo) return; // native module unavailable → assume online
    const evaluate = (state: NetInfoState) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    };
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = NetInfo.addEventListener(evaluate);
      void NetInfo.fetch().then(evaluate).catch(() => undefined);
    } catch {
      // Half-present native module — stay "online" rather than crash.
    }
    return () => unsubscribe?.();
  }, []);

  const recheck = () => {
    try {
      void NetInfo?.refresh().catch(() => undefined);
    } catch {
      // no-op
    }
  };

  return { isOffline, recheck };
}

export default useNetworkStatus;
