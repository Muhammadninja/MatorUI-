/**
 * Ties everything this install has stored to the API it was stored for.
 *
 * Staging and production builds have different bundle identifiers, so on a
 * device they never share a sandbox or a keychain. This guard covers the rest:
 * a development client re-pointed at another API, or any future build that
 * reuses an identity. When the recorded environment differs from the running
 * one, local data (session, cart, Garage selection, favorites, checkout
 * attempts, caches) is wiped before any provider hydrates, so a session can
 * never carry over from one backend to another.
 *
 * A fresh install, or an install from before this guard, has no marker: the
 * marker is written and nothing is cleared. A storage failure also clears
 * nothing; only a positive mismatch does.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAppEnvironment } from '@/config/environment';
import { clearAuthSession, setCurrentSession } from '@/services/auth-storage';
import { debugLog } from '@/services/debug-log';
import { clearStagingAccess } from '@/services/staging-access';

export const STORAGE_ENVIRONMENT_KEY = '@mator/storage-environment/v1';

export type StorageEnvironmentResult = 'kept' | 'initialized' | 'wiped';

export function storageEnvironmentId(): string {
  const env = getAppEnvironment();
  return `${env.name} ${env.apiBaseUrl.replace(/\/+$/, '')}`;
}

export async function ensureStorageEnvironment(): Promise<StorageEnvironmentResult> {
  const current = storageEnvironmentId();
  let recorded: string | null;
  try {
    recorded = await AsyncStorage.getItem(STORAGE_ENVIRONMENT_KEY);
  } catch {
    return 'kept';
  }
  if (recorded === current) return 'kept';
  if (recorded !== null) {
    debugLog('storage', 'environment changed — clearing local data');
    setCurrentSession(null);
    await Promise.all([
      clearAuthSession(),
      clearStagingAccess(),
      AsyncStorage.clear().catch(() => undefined),
    ]);
  }
  await AsyncStorage.setItem(STORAGE_ENVIRONMENT_KEY, current).catch(() => undefined);
  return recorded === null ? 'initialized' : 'wiped';
}
