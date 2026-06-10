/**
 * In-memory shim for expo-secure-store used during tests. Mirrors only
 * the three methods auth-storage exercises. Resets per process — tests
 * that need a clean slate can re-import or call the helper manually.
 */
const store = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return store.has(key) ? (store.get(key) as string) : null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}
