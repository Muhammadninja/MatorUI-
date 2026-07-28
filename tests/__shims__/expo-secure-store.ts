/**
 * In-memory shim for expo-secure-store used during tests. Mirrors only the
 * methods auth-storage / device-id exercise — AND enforces the real key rule
 * (alphanumeric + `.`, `-`, `_`) so a regression that reintroduces an illegal
 * key (e.g. a colon — the bug that silently broke session persistence) fails a
 * test instead of shipping.
 */
const store = new Map<string, string>();

/** Real SecureStore keys: non-empty, only `[A-Za-z0-9._-]`. */
const VALID_KEY = /^[A-Za-z0-9._-]+$/;
function assertKey(key: string): void {
  if (!key || !VALID_KEY.test(key)) {
    throw new Error(
      'Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".',
    );
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  assertKey(key);
  return store.has(key) ? (store.get(key) as string) : null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  assertKey(key);
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  assertKey(key);
  store.delete(key);
}

/** Test helper — wipe the in-memory keychain between tests. */
export function __resetSecureStore(): void {
  store.clear();
}
