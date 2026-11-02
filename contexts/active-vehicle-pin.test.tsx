/**
 * The bug this pins: switching the active car in the garage used to change
 * NOTHING about fitment.
 *
 * `active-vehicle.context` remembers the vehicle the user pinned and, whenever
 * the garage cache emits, prefers that pin over whichever row carries
 * `isPrimary` (so a background refresh cannot yank the car out from under
 * someone). The garage screen's "Set active" called `useGarage().setPrimary`,
 * which only flips `isPrimary` — the pin stayed put, every fit check kept using
 * the previous car, and the toast said "now active" regardless.
 *
 * The fix routes the screen through `setPrimaryVehicle`. These tests hold both
 * halves: that a bare primary flip does NOT move the pin (the trap is still
 * there, so the screen must keep using the right call), and that
 * `setPrimaryVehicle` does.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type V = {
  id: string;
  year: number;
  make: string;
  model: string;
  color: string;
  isPrimary: boolean;
  addedAt: number;
};

const COBALT: V = {
  id: 'v-cobalt', year: 2023, make: 'Chevrolet', model: 'Cobalt',
  color: 'midnight', isPrimary: true, addedAt: 1,
};
const NEXIA: V = {
  id: 'v-nexia', year: 2019, make: 'Chevrolet', model: 'Nexia',
  color: 'midnight', isPrimary: false, addedAt: 2,
};

/** Minimal stand-in for the garage cache: a list plus its subscribers. */
let vehicles: V[] = [];
let listeners: ((v: V[]) => void)[] = [];
const emit = () => listeners.forEach((l) => l(vehicles));
const auth = vi.hoisted(() => ({ profile: { id: 'account-a' } as { id: string } | null, isHydrating: false }));
vi.mock('@/contexts/user.context', () => ({
  useUserContext: () => ({ ...auth, isAuthenticated: auth.profile !== null }),
}));

const setPrimaryOnServer = vi.fn(async (id: string) => {
  vehicles = vehicles.map((v) => ({ ...v, isPrimary: v.id === id }));
  emit();
});

vi.mock('@/services/garage-service', () => ({
  garageService: {
    setSession: vi.fn(),
    subscribe: (fn: (v: V[]) => void) => {
      listeners.push(fn);
      fn(vehicles);
      return () => {
        listeners = listeners.filter((l) => l !== fn);
      };
    },
    getById: (id: string) => vehicles.find((v) => v.id === id),
    getAll: () => vehicles,
    setPrimary: (id: string) => setPrimaryOnServer(id),
  },
}));

// The pin is persisted to AsyncStorage; keep it in memory for the test.
let snapshot: unknown = null;
let delayedLoad: Promise<unknown> | null = null;
vi.mock('@/services/active-vehicle-storage', () => ({
  loadActiveVehicle: async () => delayedLoad ?? snapshot,
  saveActiveVehicle: async (s: unknown) => { snapshot = s; },
  clearActiveVehicle: async () => { snapshot = null; },
}));

import { ActiveVehicleProvider, useActiveVehicle } from './active-vehicle.context';

let api: ReturnType<typeof useActiveVehicle>;
function Probe() {
  api = useActiveVehicle();
  return null;
}

async function mount(): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <ActiveVehicleProvider>
        <Probe />
      </ActiveVehicleProvider>,
    );
  });
  return r;
}

describe('active vehicle pin', () => {
  beforeEach(() => {
    auth.profile = { id: 'account-a' };
    auth.isHydrating = false;
    vehicles = [{ ...COBALT }, { ...NEXIA }];
    listeners = [];
    snapshot = null;
    delayedLoad = null;
    setPrimaryOnServer.mockClear();
  });

  test('starts on the primary vehicle', async () => {
    await mount();
    expect(api.currentActiveVehicle?.vehicleId).toBe('v-cobalt');
  });

  test('flipping isPrimary alone does NOT move the pin', async () => {
    await mount();
    expect(api.currentActiveVehicle?.vehicleId).toBe('v-cobalt');

    // Exactly what `useGarage().setPrimary` does: server flip, cache emits.
    await act(async () => {
      await setPrimaryOnServer('v-nexia');
    });

    // Still the Cobalt. This is the trap the garage screen fell into: the
    // catalog would have kept filtering for the Cobalt after the user
    // switched to the Nexia.
    expect(api.currentActiveVehicle?.vehicleId).toBe('v-cobalt');
  });

  test('setPrimaryVehicle moves the pin and tells the backend', async () => {
    await mount();

    await act(async () => {
      await api.setPrimaryVehicle('v-nexia');
    });

    expect(api.currentActiveVehicle?.vehicleId).toBe('v-nexia');
    expect(api.currentActiveVehicle?.vehicle?.model).toBe('Nexia');
    expect(setPrimaryOnServer).toHaveBeenCalledWith('v-nexia');
  });

  test('skipBackend moves the pin without a second server call', async () => {
    // The garage screen calls the backend itself first so it can surface a
    // failure, then moves the pin with skipBackend. Without this, the flip
    // would be sent twice.
    await mount();

    await act(async () => {
      await api.setPrimaryVehicle('v-nexia', { skipBackend: true });
    });

    expect(api.currentActiveVehicle?.vehicleId).toBe('v-nexia');
    expect(setPrimaryOnServer).not.toHaveBeenCalled();
  });

  test('a removed pinned vehicle falls back to the primary', async () => {
    await mount();
    await act(async () => {
      await api.setPrimaryVehicle('v-nexia', { skipBackend: true });
    });
    expect(api.currentActiveVehicle?.vehicleId).toBe('v-nexia');

    await act(async () => {
      vehicles = vehicles.filter((v) => v.id !== 'v-nexia');
      emit();
    });

    expect(api.currentActiveVehicle?.vehicleId).toBe('v-cobalt');
  });

  test('logout clears the pin and disk; old cache emissions cannot restore it', async () => {
    const tree = await mount();
    await act(async () => { await api.setPrimaryVehicle('v-nexia', { skipBackend: true }); });
    expect(snapshot).toMatchObject({ ownerId: 'account-a' });
    await act(async () => {
      auth.profile = null;
      tree.update(<ActiveVehicleProvider><Probe /></ActiveVehicleProvider>);
    });
    await act(async () => { emit(); });
    expect(api.currentActiveVehicle).toBeNull();
    expect(snapshot).toBeNull();
    await act(async () => tree.unmount());
  });

  test('another account never hydrates the previous account pin', async () => {
    snapshot = { ownerId: 'account-a', vehicleId: 'v-nexia', fitment: { brandId: 'chevrolet', modelId: 'nexia' }, savedAt: 1 };
    auth.profile = { id: 'account-b' };
    vehicles = [];
    const tree = await mount();
    expect(api.currentActiveVehicle).toBeNull();
    await act(async () => tree.unmount());
  });

  test('delayed hydration cannot restore a pin after logout', async () => {
    let finish!: (value: unknown) => void;
    delayedLoad = new Promise((resolve) => { finish = resolve; });
    const tree = await mount();
    await act(async () => {
      auth.profile = null;
      tree.update(<ActiveVehicleProvider><Probe /></ActiveVehicleProvider>);
    });
    await act(async () => {
      finish({ ownerId: 'account-a', vehicleId: 'v-nexia', fitment: { brandId: 'chevrolet', modelId: 'nexia' }, savedAt: 1 });
    });
    expect(api.currentActiveVehicle).toBeNull();
    expect(snapshot).toBeNull();
    await act(async () => tree.unmount());
  });
});
