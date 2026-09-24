/**
 * G-3 step 3, confirmed on a production device: adding a car through the VIN
 * route made it primary on the server and in the garage hero, but every fit
 * check kept using the previous car until the app was restarted.
 *
 * The VIN screen creates with `setAsPrimary: true`. The active-vehicle context
 * prefers its pinned car over whichever row carries `isPrimary` (by design — a
 * background refresh must not yank the car out from under the user), so a bare
 * primary create leaves the pin where it was. The screen has to move the pin
 * itself once the create succeeds.
 *
 * These tests render the real screen inside the real `ActiveVehicleProvider`,
 * with the garage cache and the VIN decoder stubbed.
 */
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
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
  brandId?: string;
  modelId?: string;
  vin?: string;
};

const COBALT: V = {
  id: 'v-cobalt', year: 2020, make: 'Chevrolet', model: 'Cobalt', color: 'midnight',
  isPrimary: true, addedAt: 1, brandId: 'chevrolet', modelId: 'cobalt',
};
const VIN = 'XUFML1237N5678901';

/** Stand-in for the garage cache: a list plus its subscribers. */
let vehicles: V[] = [];
let listeners: ((v: V[]) => void)[] = [];
const emit = () => listeners.forEach((l) => l(vehicles));

const setPrimaryOnServer = vi.fn(async (_id: string) => {});

/** What `useGarage().addVehicle` does against the server: create, then the
 *  post-create refresh lands and the cache emits. */
const addVehicle = vi.fn(async (input: Record<string, unknown>) => {
  const created: V = {
    id: 'v-malibu',
    year: input.year as number,
    make: input.make as string,
    model: input.model as string,
    color: 'midnight',
    isPrimary: input.setAsPrimary === true,
    addedAt: 2,
    brandId: input.brandId as string,
    modelId: input.modelId as string,
    vin: input.vin as string,
  };
  vehicles = [
    ...vehicles.map((v) => (created.isPrimary ? { ...v, isPrimary: false } : v)),
    created,
  ];
  emit();
  return created;
});

vi.mock('@/services/garage-service', () => ({
  garageService: {
    subscribe: (fn: (v: V[]) => void) => {
      listeners.push(fn);
      fn(vehicles);
      return () => {
        listeners = listeners.filter((l) => l !== fn);
      };
    },
    getById: (id: string) => vehicles.find((v) => v.id === id),
    setPrimary: (id: string) => setPrimaryOnServer(id),
  },
}));

let snapshot: { vehicleId: string } | null = null;
vi.mock('@/services/active-vehicle-storage', () => ({
  loadActiveVehicle: async () => snapshot,
  saveActiveVehicle: async (s: { vehicleId: string }) => { snapshot = s; },
  clearActiveVehicle: async () => { snapshot = null; },
}));

vi.mock('@/hooks/use-garage', () => ({
  default: () => ({ addVehicle: (i: Record<string, unknown>) => addVehicle(i), isMutating: false }),
}));

vi.mock('@/services/vin-decoder-service', () => ({
  VinDecoderService: {
    decodeSafe: async (vin: string) => ({
      ok: true,
      data: {
        vin, make: 'Chevrolet', model: 'Malibu', year: 2022,
        engineDisplacement: null, fuelType: null, isVerified: true,
      },
    }),
  },
}));
vi.mock('@/services/reference-catalog', () => ({
  resolveCatalogIds: async () => ({ makeId: 'chevrolet', modelId: 'malibu' }),
}));

const back = vi.fn();
const dangerToast = vi.fn();
vi.mock('expo-router', () => ({ router: { back: () => back() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('react-native', () => ({
  KeyboardAvoidingView: ({ children }: { children?: React.ReactNode }) => children,
  ScrollView: ({ children }: { children?: React.ReactNode }) => children,
  Platform: { OS: 'ios' },
  StyleSheet: { create: <T,>(s: T) => s },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('lucide-react-native', () => ({ Sparkles: () => null }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('@/services/toast-service', () => ({
  toastService: {
    success: () => {},
    info: () => {},
    danger: (...a: unknown[]) => dangerToast(...a),
  },
}));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));

// Hoisted with the mocks below, which call it while building their factories.
const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-text-field', () => ({ default: host('field') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: () => null }));
vi.mock('@/components/screens-components/garage/vehicle-color-picker', () => ({
  default: () => null,
}));

import { ActiveVehicleProvider, useActiveVehicle } from '@/contexts/active-vehicle.context';
import AddVehicleScreen from './add-vehicle-screen';

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
        <AddVehicleScreen />
        <Probe />
      </ActiveVehicleProvider>,
    );
  });
  return r;
}

const find = (r: ReactTestRenderer, match: (n: ReactTestInstance) => boolean) =>
  r.root.find((n) => typeof n.type === 'string' && match(n));

/** Type the VIN, decode it, press Save — the whole VIN route. */
async function addByVin(r: ReactTestRenderer) {
  await act(async () => {
    find(r, (n) => n.props.label === 'addVehicle.vinLabel').props.onChangeText(VIN);
  });
  await act(async () => {
    await find(r, (n) => n.props.accessibilityLabel === 'addVehicle.identifyFromVin').props.onPress();
  });
  const save = find(r, (n) => n.props.title === 'addVehicle.saveVehicle');
  expect(save.props.disabled).toBe(false);
  await act(async () => {
    await save.props.onPress();
  });
}

describe('VIN route → active vehicle', () => {
  beforeEach(() => {
    vehicles = [{ ...COBALT }];
    listeners = [];
    snapshot = null;
    setPrimaryOnServer.mockClear();
    addVehicle.mockClear();
    back.mockClear();
    dangerToast.mockClear();
  });

  test('the new car becomes the active vehicle in the same session', async () => {
    const r = await mount();
    expect(api.currentActiveVehicle?.vehicleId).toBe('v-cobalt');

    await addByVin(r);

    expect(addVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: 'chevrolet', modelId: 'malibu', setAsPrimary: true, vin: VIN }),
    );
    // The regression: this stayed on the Cobalt until a restart.
    expect(api.currentActiveVehicle?.vehicleId).toBe('v-malibu');
    expect(api.currentActiveVehicle?.vehicle?.model).toBe('Malibu');
    expect(api.currentActiveVehicle?.fitment).toMatchObject({ brandId: 'chevrolet', modelId: 'malibu' });
    expect(back).toHaveBeenCalled();
  });

  test('the pin is persisted, so a cold start agrees with the session', async () => {
    const r = await mount();
    await addByVin(r);
    expect(snapshot?.vehicleId).toBe('v-malibu');
  });

  test('no second primary flip is sent — the create already made it primary', async () => {
    const r = await mount();
    await addByVin(r);
    expect(setPrimaryOnServer).not.toHaveBeenCalled();
  });

  test('a failed create leaves the active vehicle alone', async () => {
    addVehicle.mockImplementationOnce(async () => {
      throw new Error('400');
    });
    const r = await mount();
    await addByVin(r);

    expect(api.currentActiveVehicle?.vehicleId).toBe('v-cobalt');
    expect(snapshot).toBeNull();
    expect(dangerToast).toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});
