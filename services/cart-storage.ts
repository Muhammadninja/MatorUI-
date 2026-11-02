import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CartItem, PromoCode } from '@/contexts/cart.context';

/**
 * Persistence layer for the local cart.
 *
 * Cart contents are stored as a single JSON blob under one key. The on-disk
 * shape is versioned via `CART_SCHEMA_VERSION` so future cart-shape changes
 * can be detected and gracefully ignored instead of crashing the app.
 *
 * This is a local-only persistence layer. When the cart API lands the
 * provider can switch to syncing through that instead — the same shape can
 * still be cached here as an offline-first fallback.
 */

const cartStorageKey = (ownerId: string | null) => `cart:v2:${ownerId === null ? 'guest' : `user:${ownerId}`}`;
let writes: Promise<unknown> = Promise.resolve();
function write(operation: () => Promise<void>): Promise<void> {
  const result = writes.then(operation);
  writes = result.catch(() => undefined);
  return result;
}
const CART_SCHEMA_VERSION = 1;

export type StoredCart = {
  items: CartItem[];
  appliedPromoCode: string | null;
};

type StoredEnvelope = {
  v: number;
  items: CartItem[];
  appliedPromoCode: string | null;
};

function isStoredEnvelope(value: unknown): value is StoredEnvelope {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<StoredEnvelope>;
  return (
    typeof v.v === 'number' &&
    Array.isArray(v.items) &&
    (v.appliedPromoCode === null || typeof v.appliedPromoCode === 'string')
  );
}

export async function loadCart(ownerId: string | null = null): Promise<StoredCart | null> {
  try {
    await writes;
    const raw = await AsyncStorage.getItem(cartStorageKey(ownerId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredEnvelope(parsed) || parsed.v !== CART_SCHEMA_VERSION) return null;
    return {
      items: parsed.items,
      appliedPromoCode: parsed.appliedPromoCode,
    };
  } catch {
    // Corrupt JSON or storage failure — start fresh rather than crash.
    return null;
  }
}

export async function saveCart(state: {
  items: CartItem[];
  appliedPromo: PromoCode | null;
}, ownerId: string | null = null): Promise<void> {
  try {
    const envelope: StoredEnvelope = {
      v: CART_SCHEMA_VERSION,
      items: state.items,
      appliedPromoCode: state.appliedPromo?.code ?? null,
    };
    await write(() => AsyncStorage.setItem(cartStorageKey(ownerId), JSON.stringify(envelope)));
  } catch {
    // Silent — persistence failure shouldn't break the UI.
  }
}

export async function clearStoredCart(ownerId: string | null = null): Promise<void> {
  try {
    await write(() => AsyncStorage.removeItem(cartStorageKey(ownerId)));
  } catch {
    // ignore
  }
}
