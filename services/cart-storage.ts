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

const CART_STORAGE_KEY = 'cart:v1';
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

export async function loadCart(): Promise<StoredCart | null> {
  try {
    const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
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
}): Promise<void> {
  try {
    const envelope: StoredEnvelope = {
      v: CART_SCHEMA_VERSION,
      items: state.items,
      appliedPromoCode: state.appliedPromo?.code ?? null,
    };
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Silent — persistence failure shouldn't break the UI.
  }
}

export async function clearStoredCart(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // ignore
  }
}
