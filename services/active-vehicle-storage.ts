import AsyncStorage from '@react-native-async-storage/async-storage';

import type { VehicleFitment } from '@/services/uz-vehicle-catalog';

/**
 * Persistent local storage for the user's currently-active vehicle —
 * the one parts-search scopes to. AsyncStorage is intentionally the
 * write target instead of the React Query cache so the fitment
 * survives a cold start before the first network roundtrip lands.
 *
 * Shape persisted: `ActiveVehicleSnapshot`. Only the bare minimum is
 * stored — the rest (year, color, mileage) is re-hydrated from the
 * garage list when it loads. Keeping the on-disk payload tiny means
 * the boot path doesn't pay an extra parse cost on cold start.
 */

const STORAGE_KEY = '@mator/active-vehicle/v1';

export type ActiveVehicleSnapshot = {
  ownerId?: string | null;
  vehicleId: string;
  fitment: VehicleFitment;
  /** unix epoch ms — used to expire stale snapshots if we ever decide
   *  to (today we don't, but the field is here so we can without a
   *  storage-schema bump). */
  savedAt: number;
};

export async function loadActiveVehicle(): Promise<ActiveVehicleSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isActiveVehicleSnapshot(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveActiveVehicle(snapshot: ActiveVehicleSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage failures are non-fatal — the in-memory state still
    // works for the session; we'd just lose it on cold boot.
  }
}

export async function clearActiveVehicle(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // See saveActiveVehicle above.
  }
}

function isActiveVehicleSnapshot(value: unknown): value is ActiveVehicleSnapshot {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  if (typeof o.vehicleId !== 'string' || o.vehicleId.length === 0) return false;
  if (typeof o.savedAt !== 'number' || !Number.isFinite(o.savedAt)) return false;
  if (!o.fitment || typeof o.fitment !== 'object') return false;
  const f = o.fitment as Record<string, unknown>;
  return typeof f.brandId === 'string' && typeof f.modelId === 'string';
}
