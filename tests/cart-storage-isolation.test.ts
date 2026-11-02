import { beforeEach, expect, test, vi } from 'vitest';
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { storage.set(key, value); },
  removeItem: async (key: string) => { storage.delete(key); },
} }));
import { clearStoredCart, loadCart, saveCart } from '@/services/cart-storage';

const item = { id: 'a', title: 'Account A', description: '', price: 'UZS 100', quantity: 2 };
beforeEach(() => storage.clear());

test('account cache never loads for a guest or another account', async () => {
  await saveCart({ items: [item], appliedPromo: null }, 'account-a');
  expect((await loadCart('account-a'))?.items).toEqual([item]);
  expect(await loadCart()).toBeNull();
  expect(await loadCart('account-b')).toBeNull();
});

test('guest cart survives independently of authenticated carts', async () => {
  await saveCart({ items: [item], appliedPromo: null });
  await saveCart({ items: [{ ...item, id: 'b' }], appliedPromo: null }, 'account-b');
  await clearStoredCart('account-b');
  expect((await loadCart())?.items).toEqual([item]);
  expect(await loadCart('account-b')).toBeNull();
});

test('legacy unowned cart data is never shown to a guest or another user', async () => {
  storage.set('cart:v1', JSON.stringify({ v: 1, items: [item], appliedPromoCode: null }));
  expect(await loadCart()).toBeNull();
  expect(await loadCart('account-b')).toBeNull();
});

test('clearing after a scheduled save leaves the owner cache empty', async () => {
  const save = saveCart({ items: [item], appliedPromo: null }, 'account-a');
  const clear = clearStoredCart('account-a');
  await Promise.all([save, clear]);
  expect(await loadCart('account-a')).toBeNull();
});
