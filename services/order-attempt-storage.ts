import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CreateOrderInput } from '@/services/orders-service';

const storageKey = (ownerId: string) => `@mator/orders/pending-attempt/${ownerId}`;
export type PendingOrderAttempt = {
  key: string;
  createdAt: number;
  input: Omit<CreateOrderInput, 'totalLabel' | 'idempotencyKey'>;
};

export async function loadPendingOrderAttempt(ownerId: string): Promise<PendingOrderAttempt | null> {
  const raw = await AsyncStorage.getItem(storageKey(ownerId));
  if (!raw) return null;
  // Older builds stored only the key. Keep it blocked instead of silently
  // replacing it; the request cannot be safely reconstructed from that value.
  let value: Partial<PendingOrderAttempt>;
  try {
    value = JSON.parse(raw) as Partial<PendingOrderAttempt>;
  } catch {
    throw new Error('An older checkout attempt needs manual reconciliation before retrying');
  }
  if (typeof value.key !== 'string' || typeof value.createdAt !== 'number' || !value.input || typeof value.input !== 'object') {
    throw new Error('Stored checkout recovery data is invalid');
  }
  return value as PendingOrderAttempt;
}

export async function savePendingOrderAttempt(ownerId: string, attempt: PendingOrderAttempt): Promise<void> {
  await AsyncStorage.setItem(storageKey(ownerId), JSON.stringify(attempt));
}

export async function clearPendingOrderAttempt(ownerId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(ownerId));
}
