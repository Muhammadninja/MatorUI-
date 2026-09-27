/**
 * Garage add-by-details sheet — a three-step flow over native pickers.
 *
 * What these cover is the seam between the two: a wheel is not a list of
 * buttons. It always has a highlighted row, and it only reports a change when
 * that row MOVES — so a step whose answer is already the top row must still
 * count as answered. Plus what a stepped flow can get wrong on its own: going
 * back, and invalidating an answer a later step depended on.
 */
import React from 'react';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, catalog, native } = vi.hoisted(() => ({
  /** Flipped per test: does THIS binary carry the picker's native view? */
  native: { available: true },
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  catalog: {
    makes: [
      { id: 'make_chevrolet', name: 'Chevrolet' },
      { id: 'make_kia', name: 'Kia' },
    ] as { id: string; name: string; comingSoon?: boolean }[],
    models: [
      { id: 'model_cobalt', name: 'Cobalt', makeId: 'make_chevrolet' },
      { id: 'model_gentra', name: 'Gentra', makeId: 'make_chevrolet' },
    ],
  },
}));

// Mocked wholesale: react-native's real index.js is Flow-typed and the test
// parser cannot read it. `Platform.OS = 'ios'` pins the inline-wheel branch.
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  View: host('rn-view'),
  ScrollView: host('scroll'),
  ActivityIndicator: host('spinner'),
  StyleSheet: {
    absoluteFill: {},
    create: (s: unknown) => s,
    flatten: (s: unknown) => s,
  },
  // What the field probes to decide native-vs-fallback.
  UIManager: { getViewManagerConfig: () => (native.available ? {} : null) },
}));
vi.mock('expo-router', () => ({ DarkTheme: { colors: {} }, DefaultTheme: { colors: {} } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('lucide-react-native', () => ({
  ArrowLeft: host('icon'),
  Check: host('icon'),
  ChevronDown: host('icon'),
  ChevronUp: host('icon'),
  X: host('icon'),
}));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('@react-native-picker/picker', () => {
  const Picker = host('picker') as ReturnType<typeof host> & { Item: ReturnType<typeof host> };
  Picker.Item = host('picker-item');
  return { Picker };
});
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-bottom-sheet', () => ({ AppBottomSheet: host('sheet') }));
vi.mock('@/contexts/theme.context', async () => {
  const { darkTokens } = await import('@/themes');
  return { useThemeContext: () => ({ scheme: 'dark', tokens: darkTokens }) };
});
vi.mock('@/hooks/use-reference-catalog', () => ({
  useMakes: () => ({ data: catalog.makes, isPending: false, isError: false, refetch: () => {} }),
  useModels: (makeId?: string | null) => ({
    data: makeId === 'make_chevrolet' ? catalog.models : [],
    isPending: false,
    isError: false,
    refetch: () => {},
  }),
}));

import { GarageVehiclePickerSheet, type PickedVehicle } from './garage-vehicle-picker-sheet';

function mount(onSubmit: (p: PickedVehicle) => void = () => {}, onUseVin?: () => void) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <GarageVehiclePickerSheet
        visible
        onClose={() => {}}
        onSubmit={onSubmit}
        onUseVin={onUseVin}
      />,
    );
  });

  const find = (type: string, testID: string) =>
    r.root.findAll((n) => (n.type as string) === type && n.props.testID === testID)[0] ?? null;

  /** Which step is on screen, told by which field exists. */
  const stepField = () =>
    ['make', 'model', 'year'].find((s) => find('pressable', `vehicle-${s}-picker`)) ?? null;
  /** The value line of the field on screen (label row first, value second). */
  const fieldValue = (step: string) => {
    const texts = find('pressable', `vehicle-${step}-picker`)!.findAll(
      (n) => (n.type as string) === 'text',
    );
    return String(texts[texts.length - 1].children[0]);
  };
  /** Tap a field's row, which is what opens its wheel. */
  const openField = (step: string) =>
    act(() => find('pressable', `vehicle-${step}-picker`)!.props.onPress());
  /** Move the open wheel, the way a settled UIPickerView reports. */
  const spin = (value: string) => {
    const wheels = r.root.findAll((n) => (n.type as string) === 'picker');
    act(() => wheels[wheels.length - 1].props.onValueChange(value));
  };
  const next = () => find('button', 'picker-step-next')!;
  const back = () => find('pressable', 'picker-step-back');
  const vinLink = () => find('button', 'use-vin-instead');
  const tap = (node: ReactTestInstance | null) => act(() => node!.props.onPress());

  return { r, stepField, fieldValue, openField, spin, next, back, vinLink, tap };
}

beforeEach(() => {
  native.available = true;
});

describe('GarageVehiclePickerSheet steps', () => {
  test('opens on the make question alone — no model or year in sight', () => {
    const { stepField, back } = mount();
    expect(stepField()).toBe('make');
    // Nowhere to go back to from the first question.
    expect(back()).toBeNull();
  });

  test('arrives unanswered, and the closed field says so', () => {
    const { r, fieldValue, next } = mount();
    // The brand used to arrive already chosen, which read as "always active".
    expect(fieldValue('make')).toBe('garage.notSelected');
    expect(next().props.disabled).toBe(true);
    expect(next().props.title).toBe('common.continue');
    // No wheel until asked for: an open one would have to centre a row, and
    // centring a placeholder leaves the top half of the wheel blank.
    expect(r.root.findAll((n) => (n.type as string) === 'picker')).toHaveLength(0);
  });

  test('opening the wheel commits the row it centres', () => {
    const { r, fieldValue, openField, next } = mount();
    openField('make');
    expect(r.root.findAll((n) => (n.type as string) === 'picker')).toHaveLength(1);
    // Whatever the wheel shows centred IS the answer — no scroll required for
    // someone whose brand is already the top row.
    expect(fieldValue('make')).toBe('Chevrolet');
    expect(next().props.disabled).toBe(false);
  });

  test('walks make → model → year, one question at a time', () => {
    const { stepField, openField, next, tap, spin } = mount();

    openField('make');
    tap(next());
    expect(stepField()).toBe('model');

    openField('model');
    spin('model_gentra');
    tap(next());
    expect(stepField()).toBe('year');
    // The last step asks to save rather than continue.
    expect(next().props.title).toBe('common.save');
  });

  test('back returns to the previous question with its answer intact', () => {
    const { stepField, fieldValue, openField, next, back, tap, spin } = mount();
    openField('make');
    spin('make_kia');
    tap(next());
    expect(stepField()).toBe('model');

    tap(back());
    expect(stepField()).toBe('make');
    expect(fieldValue('make')).toBe('Kia');
  });

  test('changing the make drops the model chosen under the old one', () => {
    const { stepField, fieldValue, openField, next, back, tap, spin } = mount();
    openField('make');
    tap(next()); // Chevrolet -> model step
    openField('model');
    spin('model_gentra');
    expect(fieldValue('model')).toBe('Gentra');

    tap(back());
    // Back remounts the make field closed, with its answer intact.
    expect(fieldValue('make')).toBe('Chevrolet');
    openField('make');
    spin('make_kia'); // Kia has no models in this fixture
    tap(next());
    expect(stepField()).toBe('model');
    expect(fieldValue('model')).toBe('addVehicle.noModels');
    // Nothing to answer with, so the flow cannot move past it.
    expect(next().props.disabled).toBe(true);
  });

  test('Save submits real catalog ids and a numeric year', () => {
    const picked: PickedVehicle[] = [];
    const { openField, next, tap, spin } = mount((p) => picked.push(p));

    openField('make'); // centres Chevrolet
    tap(next());
    openField('model'); // centres Cobalt
    tap(next());
    openField('year');
    spin('2019');
    tap(next()); // save

    expect(picked).toEqual([
      {
        makeId: 'make_chevrolet',
        makeName: 'Chevrolet',
        modelId: 'model_cobalt',
        modelName: 'Cobalt',
        year: 2019,
      },
    ]);
  });

  test('the VIN escape hatch is offered on the first step only', () => {
    expect(mount().vinLink()).toBeNull();

    let handed = 0;
    const { vinLink, next, tap, openField } = mount(
      () => {},
      () => {
        handed += 1;
      },
    );
    tap(vinLink());
    expect(handed).toBe(1);

    openField('make');
    tap(next()); // onto the model step
    expect(vinLink()).toBeNull();
  });

  test('a binary without the native picker falls back to a tappable list', () => {
    // What an older dev client hits: the native view is absent, and RN would
    // otherwise render "Unimplemented component".
    native.available = false;
    const { fieldValue, openField, next, r } = mount();

    // A list has no centred row, so opening it answers nothing.
    expect(fieldValue('make')).toBe('garage.notSelected');
    openField('make');
    expect(fieldValue('make')).toBe('garage.notSelected');
    expect(next().props.disabled).toBe(true);

    const option = r.root.find(
      (n) =>
        (n.type as string) === 'pressable' &&
        n.props.testID === 'vehicle-make-picker-option-make_kia',
    );
    act(() => option.props.onPress());
    expect(fieldValue('make')).toBe('Kia');
    expect(next().props.disabled).toBe(false);
  });
});
