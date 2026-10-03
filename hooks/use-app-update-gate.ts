import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { fetchAppConfig } from '@/services/app-config-service';

// Fallbacks used only until the backend returns store links in /v1/app/config.
// Android resolves by package; iOS needs the numeric App Store id, so the real
// link should come from the backend (`ios_store_url`).
const ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.mator.myapp';
const IOS_STORE_URL = 'https://apps.apple.com/app/mator';

/** True when dotted-numeric `a` is strictly below `b` (e.g. "1.2.0" < "1.3.0"). */
function isVersionBelow(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

export type AppUpdateGate = {
  /** This build is below the server's minimum → must update to continue. */
  updateRequired: boolean;
  /** Store URL for the current platform (backend-provided, else a fallback). */
  storeUrl: string;
};

/**
 * Force-update gate. Reads `min_supported_version` from the remote app config and
 * compares it to this build's version (`app.json` → baked into the binary). Fails
 * open: if the config is missing/unreachable, `updateRequired` is false.
 */
export function useAppUpdateGate(): AppUpdateGate {
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';

  const query = useQuery({
    queryKey: ['app-config'],
    queryFn: ({ signal }) => fetchAppConfig(signal),
    staleTime: 5 * 60_000,
  });

  const config = query.data ?? null;
  const min = config?.minSupportedVersion ?? null;
  const updateRequired = !!min && isVersionBelow(currentVersion, min);

  const storeUrl =
    Platform.OS === 'ios'
      ? config?.iosStoreUrl ?? IOS_STORE_URL
      : config?.androidStoreUrl ?? ANDROID_STORE_URL;

  return { updateRequired, storeUrl };
}

export default useAppUpdateGate;
