import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * An order placed for online payment and not known to be paid yet.
 *
 * The backend empties its cart when the order is created, so after a failed payment the app
 * puts the lines back, and the cart then looks ready to order again. This record is what
 * stops that becoming a second order: it outlives the screen and the app, and the checkout
 * offers to pay this order before it offers to place another. It holds no card or payment
 * data, and it is only ever a hint: the order's status on the backend decides.
 */
export type PendingPayment = {
  orderId: string;
  /** What this order charges, as the backend stated it. */
  totalLabel: string;
  /** The cart this order came from. Paying only clears a cart still holding those lines. */
  cartKey: string;
};

const storageKey = (ownerId: string | null) =>
  `pending-payment:v1:${ownerId === null ? 'guest' : `user:${ownerId}`}`;

function isPendingPayment(value: unknown): value is PendingPayment {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<PendingPayment>;
  return (
    typeof v.orderId === 'string' &&
    v.orderId.length > 0 &&
    typeof v.totalLabel === 'string' &&
    typeof v.cartKey === 'string'
  );
}

export async function loadPendingPayment(ownerId: string | null): Promise<PendingPayment | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(ownerId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPendingPayment(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function savePendingPayment(
  ownerId: string | null,
  record: PendingPayment,
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(ownerId), JSON.stringify(record));
  } catch {
    // Storage failing only loses the guard across a restart. The payment goes on.
  }
}

export async function clearPendingPayment(ownerId: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(ownerId));
  } catch {
    // As above.
  }
}
