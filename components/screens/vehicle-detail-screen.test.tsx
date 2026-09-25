/**
 * G-3 step 5, confirmed on a production device: the vehicle detail screen
 * printed `68,500 км` to a Russian UI. It carried its own `formatMileage`
 * hard-coded to `en-US`, which the shared `utils/mileage` fix never reached.
 *
 * Renders the real screen and reads the Mileage cell in each app language.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let language: 'en' | 'ru' | 'uz' = 'en';
let activeVehicleId = 'v-malibu';
const UNIT = { en: 'km', ru: 'км', uz: 'km' } as const;

const MALIBU = {
  id: 'v-malibu', year: 2022, make: 'Chevrolet', model: 'Malibu', color: 'midnight',
  isPrimary: true, addedAt: 1, mileage: 68500,
};

vi.mock('@/hooks/use-garage', () => ({
  default: () => ({
    vehicles: [MALIBU],
    primaryVehicle: MALIBU,
    updateVehicle: async () => MALIBU,
    removeVehicle: async () => {},
    isMutating: false,
  }),
}));
vi.mock('@/contexts/active-vehicle.context', () => ({
  useActiveVehicle: () => ({
    currentActiveVehicle: { vehicleId: activeVehicleId },
    setPrimaryVehicle: async () => {},
  }),
}));
vi.mock('@/contexts/language.context', () => ({
  useLanguageContext: () => ({ language }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => (k === 'vehicleDetail.mileageUnit' ? UNIT[language] : k),
  }),
}));

vi.mock('expo-router', () => ({
  router: { back: () => {}, push: () => {} },
  useLocalSearchParams: () => ({ id: 'v-malibu' }),
}));
vi.mock('react-native', () => ({
  ScrollView: ({ children }: { children?: React.ReactNode }) => children,
  StyleSheet: { create: <T,>(s: T) => s },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  CarFront: () => null,
  Check: () => null,
  Pencil: () => null,
  Trash2: () => null,
  X: () => null,
}));
vi.mock('@/services/toast-service', () => ({
  toastService: { success: () => {}, info: () => {}, danger: () => {} },
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
vi.mock('@/components/screens-components/garage/vehicle-color-picker', () => ({
  default: () => null,
}));

import VehicleDetailScreen from './vehicle-detail-screen';

async function mileageCell(lang: typeof language): Promise<string> {
  language = lang;
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<VehicleDetailScreen />);
  });
  const cell = r.root.find(
    (n) => n.props.label === 'vehicleDetail.mileage' && typeof n.props.value === 'string',
  );
  return cell.props.value as string;
}

describe('vehicle detail — mileage', () => {
  test('groups with a space in Russian', async () => {
    expect(await mileageCell('ru')).toBe('68 500 км');
  });

  test('groups with a space in Uzbek', async () => {
    expect(await mileageCell('uz')).toBe('68 500 km');
  });

  test('keeps the comma in English', async () => {
    expect(await mileageCell('en')).toBe('68,500 km');
  });
});

// Dark-theme QA: "Set active" rendered as a full-width white slab with a thin
// two-line label, stacked on a second white slab ("Edit details") — both used
// solid kinds whose dark-mode fill is #fff. They are secondary actions, so
// they take the app's secondary-button pattern (outline), like
// order-confirmation and the global modal do.
describe('vehicle detail — actions', () => {
  async function actions() {
    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(<VehicleDetailScreen />);
    });
    return r.root.findAll((n) => n.type === 'button');
  }

  test('a non-active vehicle offers "Set active" as an outline button', async () => {
    activeVehicleId = 'another-car';
    const setActive = (await actions()).find((b) => b.props.title === 'vehicleDetail.setActive');
    expect(setActive).toBeDefined();
    expect(setActive!.props.variant).toBe('outline');
    expect(setActive!.props.kind).toBe('secondary');
    // Stays inside the button scale; typography comes from AppButton itself.
    expect(setActive!.props.size).toBe('lg');
    expect(setActive!.props.textStyle).toBeUndefined();
  });

  test('"Edit details" is an outline button too — no solid fill on this screen', async () => {
    activeVehicleId = 'another-car';
    for (const b of await actions()) {
      expect(b.props.variant, String(b.props.title)).toBe('outline');
      expect(b.props.kind, String(b.props.title)).not.toBe('brand');
    }
  });

  test('the active vehicle hides "Set active"', async () => {
    activeVehicleId = 'v-malibu';
    const titles = (await actions()).map((b) => b.props.title);
    expect(titles).toEqual(['vehicleDetail.editDetails']);
  });
});
