/**
 * One checkout operation, one `Idempotency-Key`.
 *
 * A POST /v1/orders whose answer was lost (a timeout, a dropped connection, the app
 * killed mid-request) may still have placed the order. Every later attempt at the same
 * checkout therefore sends the same key, and the server answers with the order already
 * placed instead of placing a second one. The key is kept in memory and in storage, so it
 * survives a remount and an app restart, and it is given up only when the server has
 * confirmed how the checkout ended:
 *   • an order came back — the checkout is done;
 *   • IDEMPOTENCY_KEY_REUSED / _EXPIRED — an order was already placed under this key;
 *   • INVALID_IDEMPOTENCY_KEY — this key can never be accepted.
 * Every other failure keeps it. A refusal such as a changed total placed nothing, and the
 * corrected order reuses the key: should the earlier, unanswered attempt have gone through
 * after all, the server says so (REUSED) rather than placing a second order.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CreateOrderInput, CreateOrderResult } from '@/services/orders-service';

export type PendingOrderAttempt = { key: string; createdAt: number };

/** The server returns an order for a key for 30 days; an older key is never reused. */
export const ORDER_ATTEMPT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const CLOSING_CODES: ReadonlySet<string> = new Set([
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_KEY_EXPIRED',
  'INVALID_IDEMPOTENCY_KEY',
]);

const storageKey = (ownerId: string) => `@mator/orders/pending-attempt/${ownerId}`;

/** This process's view, so a storage failure never costs the retries of this session. */
const memory = new Map<string, PendingOrderAttempt>();

/** Acquire and release one at a time, so two taps can never mint two keys. */
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.catch(() => undefined);
  return run;
}

/** 8–128 of letters, digits and `_`: within the backend's `Idempotency-Key` alphabet. */
export function newOrderKey(): string {
  const random = Array.from({ length: 2 }, () => Math.random().toString(36).slice(2, 12)).join('');
  return `ord_${Date.now().toString(36)}_${random}`;
}

async function readStored(ownerId: string): Promise<PendingOrderAttempt | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(ownerId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingOrderAttempt>;
    return typeof value.key === 'string' && typeof value.createdAt === 'number'
      ? { key: value.key, createdAt: value.createdAt }
      : null;
  } catch {
    // Unreadable: no key to resume. Sending a fresh one is what a build without keys did.
    return null;
  }
}

/** The key of the checkout in progress for this buyer, or a new one. Saved before any request. */
export function acquireOrderAttempt(ownerId: string, now: number = Date.now()): Promise<PendingOrderAttempt> {
  return serialized(async () => {
    let attempt = memory.get(ownerId) ?? (await readStored(ownerId));
    if (!attempt || attempt.createdAt + ORDER_ATTEMPT_MAX_AGE_MS <= now) {
      attempt = { key: newOrderKey(), createdAt: now };
    }
    memory.set(ownerId, attempt);
    try {
      await AsyncStorage.setItem(storageKey(ownerId), JSON.stringify(attempt));
    } catch {
      // Kept in memory: retries in this session still share the key.
    }
    return attempt;
  });
}

/** End the checkout that used `key`. A newer checkout's key is left alone. */
export function releaseOrderAttempt(ownerId: string, key: string): Promise<void> {
  return serialized(async () => {
    if (memory.get(ownerId)?.key === key) memory.delete(ownerId);
    try {
      if ((await readStored(ownerId))?.key === key) await AsyncStorage.removeItem(storageKey(ownerId));
    } catch {
      // Already gone from memory; a stale stored key is answered REUSED and then released.
    }
  });
}

function codeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

/**
 * Send one checkout attempt under the operation's key. Without a signed-in owner there is
 * no checkout to resume (the server refuses it anyway), so nothing is kept.
 */
export async function submitOrderAttempt(
  ownerId: string | null,
  input: CreateOrderInput,
  send: (input: CreateOrderInput) => Promise<CreateOrderResult>,
): Promise<CreateOrderResult> {
  if (!ownerId) return send(input);
  const attempt = await acquireOrderAttempt(ownerId);
  let result: CreateOrderResult;
  try {
    result = await send({ ...input, idempotencyKey: attempt.key });
  } catch (error) {
    const code = codeOf(error);
    if (code && CLOSING_CODES.has(code)) await releaseOrderAttempt(ownerId, attempt.key);
    throw error;
  }
  await releaseOrderAttempt(ownerId, attempt.key);
  return result;
}

/** Tests only: forget this process's keys, as an app restart does. */
export function resetOrderAttemptMemoryForTests(): void {
  memory.clear();
}
