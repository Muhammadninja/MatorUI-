import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Address, AddressInput } from '@/services/orders-service';

const state = vi.hoisted(() => ({
  owner: 'account-a' as string | null,
  epoch: 0,
  createAddress: vi.fn(), updateAddress: vi.fn(), listAddresses: vi.fn(),
}));
vi.mock('@/services/api-client', () => ({ getAuthRequestEpoch: () => state.epoch }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({
  profile: state.owner ? { id: state.owner } : null,
  isAuthenticated: state.owner !== null, isHydrating: false,
}) }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: {
  createAddress: state.createAddress, updateAddress: state.updateAddress,
  listAddresses: state.listAddresses,
} }));
import { ordersQueryKeys, useAddresses, useCreateAddress, useUpdateAddress } from '@/hooks/use-orders';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const input: AddressInput = { label: 'Test point', name: '', line1: '', city: '', lat: 41, lng: 69 };
const old: Address = { id: 'point-a', ...input, lat: 40, lng: 68 };
const saved: Address = { ...old, lat: 41, lng: 69 };
const other: Address = { ...old, id: 'point-b' };
const key = (owner: string) => [...ordersQueryKeys.addresses(), owner];
let tree: ReactTestRenderer | undefined;
let client: QueryClient;
beforeEach(() => {
  state.owner = 'account-a';
  state.epoch = 0;
  vi.resetAllMocks();
  // Keep the background refresh pending: the immediate cache write must be enough.
  state.listAddresses.mockImplementation(() => new Promise<Address[]>(() => {}));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
  client.setQueryData(key('account-a'), [old]);
  client.setQueryData(key('account-b'), [other]);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
  client.clear();
});
async function mount() {
  let value!: { addresses: ReturnType<typeof useAddresses>; create: ReturnType<typeof useCreateAddress>; update: ReturnType<typeof useUpdateAddress> };
  function Probe() {
    value = { addresses: useAddresses(), create: useCreateAddress(), update: useUpdateAddress() };
    return null;
  }
  const element = () => <QueryClientProvider client={client}><Probe /></QueryClientProvider>;
  await act(async () => { tree = create(element()); });
  return {
    current: () => value,
    owner: async (owner: string | null) => {
      await act(async () => { state.owner = owner; tree!.update(element()); });
    },
  };
}
const operations = ['create', 'update'] as const;
type Operation = typeof operations[number];
function submit(screen: Awaited<ReturnType<typeof mount>>, operation: Operation) {
  return operation === 'create'
    ? screen.current().create.mutateAsync(input)
    : screen.current().update.mutateAsync({ id: old.id, input });
}
const transport = (operation: Operation) => operation === 'create' ? state.createAddress : state.updateAddress;

test.each(operations)('%s publishes the saved point to owner-scoped readers before a background refresh completes', async (operation) => {
  const result = operation === 'create' ? { ...saved, id: 'new-point-a' } : saved;
  const expected = operation === 'create' ? [old, result] : [result];
  transport(operation).mockResolvedValueOnce(result);
  const screen = await mount();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await act(async () => { expect(await submit(screen, operation)).toEqual(result); });
  expect(client.getQueryData(key('account-a'))).toEqual(expected);
  expect(client.getQueryData(key('account-b'))).toEqual([other]);
  expect(client.getQueryData(ordersQueryKeys.addresses())).toBeUndefined();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: key('account-a') });
  // NotifyManager batches reader notification; no server response is released here.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  expect(screen.current().addresses.items).toEqual(expected);
  expect(state.listAddresses).toHaveBeenCalledTimes(1);
});

test.each(operations)('%s discards a deferred result after owner change without writing or invalidating either cache', async (operation) => {
  let finish!: (address: Address) => void;
  transport(operation).mockImplementationOnce(() => new Promise<Address>((resolve) => { finish = resolve; }));
  const screen = await mount();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  let pending!: Promise<Address>;
  await act(async () => { pending = submit(screen, operation); });
  await screen.owner('account-b');
  await act(async () => {
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    finish(saved);
    await rejected;
  });
  expect(client.getQueryData(key('account-a'))).toEqual([old]);
  expect(client.getQueryData(key('account-b'))).toEqual([other]);
  expect(client.getQueryData(ordersQueryKeys.addresses())).toBeUndefined();
  expect(invalidate).not.toHaveBeenCalled();
});

test.each(operations)('%s never revives an old A result after A → B → A', async (operation) => {
  let finish!: (address: Address) => void;
  transport(operation).mockImplementationOnce(() => new Promise<Address>((resolve) => { finish = resolve; }));
  const screen = await mount();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  let pending!: Promise<Address>;
  await act(async () => { pending = submit(screen, operation); });
  await screen.owner('account-b');
  await screen.owner('account-a');
  await act(async () => {
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    finish(saved);
    await rejected;
  });
  expect(client.getQueryData(key('account-a'))).toEqual([old]);
  expect(client.getQueryData(key('account-b'))).toEqual([other]);
  expect(invalidate).not.toHaveBeenCalled();
});

test.each(operations)('%s rejects work as soon as the auth epoch changes, before React renders', async (operation) => {
  let finish!: (address: Address) => void;
  transport(operation).mockImplementationOnce(() => new Promise<Address>((resolve) => { finish = resolve; }));
  const screen = await mount();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  let pending!: Promise<Address>;
  await act(async () => { pending = submit(screen, operation); });
  state.epoch++;
  await act(async () => {
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    finish(saved);
    await rejected;
    await expect(submit(screen, operation)).rejects.toMatchObject({ name: 'AbortError' });
  });
  expect(transport(operation)).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(key('account-a'))).toEqual([old]);
  expect(invalidate).not.toHaveBeenCalled();
});

test.each(operations)('%s rejects a retained old-owner action and a guest action before calling the transport', async (operation) => {
  const screen = await mount();
  const retained = operation === 'create'
    ? () => screen.current().create.mutateAsync(input)
    : () => screen.current().update.mutateAsync({ id: old.id, input });
  const staleMutation = operation === 'create' ? screen.current().create.mutateAsync : screen.current().update.mutateAsync;
  await screen.owner('account-b');
  await act(async () => {
    if (operation === 'create') {
      await expect((staleMutation as ReturnType<typeof useCreateAddress>['mutateAsync'])(input)).rejects.toMatchObject({ name: 'AbortError' });
    } else {
      await expect((staleMutation as ReturnType<typeof useUpdateAddress>['mutateAsync'])({ id: old.id, input })).rejects.toMatchObject({ name: 'AbortError' });
    }
  });
  await screen.owner(null);
  await act(async () => { await expect(retained()).rejects.toMatchObject({ name: 'AbortError' }); });
  expect(transport(operation)).not.toHaveBeenCalled();
});
