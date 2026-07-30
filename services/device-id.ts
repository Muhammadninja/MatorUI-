/**
 * Stable per-install device id. Generated once and persisted in SecureStore so it
 * survives reloads/restarts. Used for auth/debug logging (and ready for
 * `/v1/devices` registration if wired later).
 */

import * as SecureStore from 'expo-secure-store';

const KEY = 'mator.device_id';
let cached: string | null = null;

function generate(): string {
  const rnd = () => Math.random().toString(36).slice(2, 10);
  return `dev_${Date.now().toString(36)}_${rnd()}${rnd()}`;
}

/** Returns the stable device id, creating + persisting it on first call. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch {
    /* SecureStore read failed — fall through to a fresh (unpersisted) id */
  }
  const id = generate();
  cached = id;
  SecureStore.setItemAsync(KEY, id).catch(() => undefined);
  return id;
}
