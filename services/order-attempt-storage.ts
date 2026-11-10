import AsyncStorage from '@react-native-async-storage/async-storage';

const storageKey = (ownerId: string) => `@mator/orders/pending-attempt/${ownerId}`;

export async function loadPendingOrderAttempt(ownerId: string): Promise<string | null> {
  return AsyncStorage.getItem(storageKey(ownerId));
}

export async function savePendingOrderAttempt(ownerId: string, key: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(ownerId), key);
}

export async function clearPendingOrderAttempt(ownerId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(ownerId));
}
