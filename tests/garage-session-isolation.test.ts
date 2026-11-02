import { beforeEach, expect, test, vi } from 'vitest';
import { garageService, type Vehicle } from '@/services/garage-service';
import type { GarageTransport } from '@/services/garage-api';

const vehicle: Vehicle = { id: 'car-a', year: 2024, make: 'Chevrolet', model: 'Cobalt', color: 'midnight', isPrimary: true, addedAt: 1 };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
let transport: GarageTransport;
beforeEach(() => {
  transport = {
    list: vi.fn().mockResolvedValue([vehicle]), get: vi.fn(), create: vi.fn(),
    update: vi.fn(), remove: vi.fn(), setPrimary: vi.fn(),
  };
  garageService.setTransport(transport);
  garageService.reset();
  garageService.setSession('account-a');
});

test('late primary response cannot repopulate garage after logout', async () => {
  await garageService.refresh();
  const pending = deferred<Vehicle[]>();
  vi.mocked(transport.setPrimary).mockReturnValue(pending.promise);
  const result = garageService.setPrimary(vehicle.id).catch((error) => error);
  garageService.setSession(null);
  pending.resolve([vehicle]);
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(garageService.getVehicles()).toEqual([]);
});

test('old create completion cannot trigger a read in the new account', async () => {
  const pending = deferred<Vehicle>();
  vi.mocked(transport.create).mockReturnValue(pending.promise);
  const result = garageService.addVehicle({ year: 2024, make: 'Chevrolet', model: 'Cobalt', color: 'midnight' }).catch((error) => error);
  garageService.setSession('account-b');
  pending.resolve(vehicle);
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(transport.list).not.toHaveBeenCalled();
  expect(garageService.getVehicles()).toEqual([]);
});

test('old update completion cannot replace a new account row', async () => {
  const pending = deferred<Vehicle>();
  vi.mocked(transport.update).mockReturnValue(pending.promise);
  const result = garageService.updateVehicle(vehicle.id, { nickname: 'Old account' }).catch((error) => error);
  garageService.setSession('account-b');
  vi.mocked(transport.list).mockResolvedValue([{ ...vehicle, nickname: 'New account' }]);
  await garageService.refresh();
  pending.resolve({ ...vehicle, nickname: 'Old account' });
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(garageService.getVehicles()[0].nickname).toBe('New account');
});
