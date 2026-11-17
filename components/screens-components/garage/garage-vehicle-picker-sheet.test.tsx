/**
 * Garage add-by-details sheet: three steps over searchable lists.
 *
 * Covers what a stepped list flow can get wrong: answering and moving on,
 * going back with the answer still marked, a new make dropping the old model,
 * search narrowing a list, saving real catalog ids, and "Не нашли автомобиль?"
 * offering only what works (no fake request).
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

const { host, catalog } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  catalog: {
    makes: [
      { id: 'make_kia', name: 'Kia', logoUrl: null },
      { id: 'make_chevrolet', name: 'Chevrolet', logoUrl: 'https://cdn/chevy.png' },
      { id: 'make_byd', name: 'BYD', logoUrl: null, comingSoon: true },
    ] as { id: string; name: string; logoUrl: string | null; comingSoon?: boolean }[],
    models: [
      { id: 'model_gentra', name: 'Gentra', makeId: 'make_chevrolet' },
      { id: 'model_cobalt', name: 'Cobalt', makeId: 'make_chevrolet' },
      { id: 'model_rio', name: 'Rio', makeId: 'make_kia' },
    ],
  },
}));

// Mocked wholesale: react-native's real index.js is Flow-typed and the test
// parser cannot read it. The list renders every row, as a short list would.
vi.mock('react-native', async () => {
  const R = await import('react');
  return {
    Platform: { OS: 'ios' },
    ActivityIndicator: host('spinner'),
    TextInput: host('input'),
    ScrollView: host('scroll'),
    FlatList: ({ data, renderItem, ListEmptyComponent, testID }: {
      data: unknown[];
      renderItem: (a: { item: unknown; index: number }) => React.ReactNode;
      ListEmptyComponent?: React.ReactNode;
      testID?: string;
    }) =>
      R.createElement(
        'list',
        { testID },
        data.length ? data.map((item, index) => R.createElement(R.Fragment, { key: index }, renderItem({ item, index }))) : ListEmptyComponent,
      ),
  };
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('lucide-react-native', () => ({
  ArrowLeft: host('icon'),
  Check: host('icon'),
  Info: host('icon'),
  Search: host('icon'),
  X: host('icon'),
}));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-image', () => ({ default: host('image') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-text-field', () => ({ AppTextField: host('field') }));
vi.mock('@/components/shared/app-bottom-sheet', () => ({ AppBottomSheet: host('sheet') }));
vi.mock('@/themes', () => ({ APP_FONTS: { default: 'Inter_400Regular' } }));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ scheme: 'light', tokens: new Proxy({}, { get: () => '#000' }) }),
}));
vi.mock('@/hooks/use-reference-catalog', () => ({
  useMakes: () => ({ data: catalog.makes, isPending: false, isError: false, refetch: () => {} }),
  useModels: (makeId?: string | null) => ({
    data: catalog.models.filter((m) => m.makeId === makeId),
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
      <GarageVehiclePickerSheet visible onClose={() => {}} onSubmit={onSubmit} onUseVin={onUseVin} />,
    );
  });
  const find = (type: string, testID: string) =>
    r.root.findAll((n) => (n.type as string) === type && n.props.testID === testID)[0] ?? null;
  const step = () => ['make', 'model', 'year'].find((s) => find('list', `vehicle-${s}-list`)) ?? null;
  const options = (s: string) =>
    r.root
      .findAll((n) => (n.type as string) === 'pressable' && String(n.props.testID).startsWith(`vehicle-${s}-list-option-`))
      .map((n) => String(n.props.testID).replace(`vehicle-${s}-list-option-`, ''));
  const choose = (s: string, value: string) => act(() => find('pressable', `vehicle-${s}-list-option-${value}`)!.props.onPress());
  const selected = (s: string, value: string) =>
    find('pressable', `vehicle-${s}-list-option-${value}`)!.props.accessibilityState.selected as boolean;
  const search = (s: string, text: string) => act(() => find('input', `vehicle-${s}-list-search`)!.props.onChangeText(text));
  const next = () => find('button', 'picker-step-next');
  const back = () => find('pressable', 'picker-step-back');
  const tap = (node: ReactTestInstance | null) => act(() => node!.props.onPress());
  return { r, find, step, options, choose, selected, search, next, back, tap };
}

describe('GarageVehiclePickerSheet', () => {
  test('opens on makes alone, alphabetical, including makes that are coming soon', () => {
    const s = mount();
    expect(s.step()).toBe('make');
    // BYD is "coming soon" for parts, but its owners can still add their car.
    expect(s.options('make')).toEqual(['make_byd', 'make_chevrolet', 'make_kia']);
    expect(s.next()!.props.disabled).toBe(true);
  });

  test('a make shows its logo when the catalog has one, its initial otherwise', () => {
    const s = mount();
    const chevy = s.find('pressable', 'vehicle-make-list-option-make_chevrolet')!;
    expect(chevy.findAll((n) => (n.type as string) === 'image')).toHaveLength(1);
    const kia = s.find('pressable', 'vehicle-make-list-option-make_kia')!;
    expect(kia.findAll((n) => (n.type as string) === 'image')).toHaveLength(0);
  });

  test('search narrows the list, ignoring case and spaces, and says when nothing matches', () => {
    const s = mount();
    s.search('make', ' CHEV ');
    expect(s.options('make')).toEqual(['make_chevrolet']);
    s.search('make', 'zzz');
    expect(s.options('make')).toEqual([]);
    expect(s.find('text', 'vehicle-make-list-empty')).not.toBeNull();
  });

  test('tapping answers and moves on: make → model → year', () => {
    const s = mount();
    s.choose('make', 'make_chevrolet');
    expect(s.step()).toBe('model');
    expect(s.options('model')).toEqual(['model_cobalt', 'model_gentra']);
    s.choose('model', 'model_cobalt');
    expect(s.step()).toBe('year');
    expect(s.next()!.props.title).toBe('common.save');
    expect(s.next()!.props.disabled).toBe(true);
  });

  test('back returns to the previous step with its answer still marked', () => {
    const s = mount();
    s.choose('make', 'make_chevrolet');
    s.choose('model', 'model_gentra');
    s.tap(s.back());
    expect(s.step()).toBe('model');
    expect(s.selected('model', 'model_gentra')).toBe(true);
    s.tap(s.back());
    expect(s.selected('make', 'make_chevrolet')).toBe(true);
  });

  test('a different make drops the model chosen under the old one', () => {
    const s = mount();
    s.choose('make', 'make_chevrolet');
    s.choose('model', 'model_gentra');
    s.tap(s.back());
    s.tap(s.back());
    s.choose('make', 'make_kia');
    expect(s.step()).toBe('model');
    expect(s.options('model')).toEqual(['model_rio']);
    expect(s.selected('model', 'model_rio')).toBe(false);
    expect(s.next()!.props.disabled).toBe(true);
  });

  test('Save hands back real catalog ids and a numeric year', () => {
    const onSubmit = vi.fn();
    const s = mount(onSubmit);
    s.choose('make', 'make_chevrolet');
    s.choose('model', 'model_cobalt');
    const year = s.options('year')[1]!;
    s.choose('year', year);
    s.tap(s.next());
    expect(onSubmit).toHaveBeenCalledWith({
      makeId: 'make_chevrolet',
      makeName: 'Chevrolet',
      modelId: 'model_cobalt',
      modelName: 'Cobalt',
      year: Number(year),
    });
  });

  const type = (s: ReturnType<typeof mount>, field: 'make' | 'model', text: string) =>
    act(() => s.find('field', `manual-${field}-field`)!.props.onChangeText(text));

  test('"Нет в списке" on the make step: type make and model, pick a year up to this year, save typed names', () => {
    const onSubmit = vi.fn();
    const s = mount(onSubmit, () => {});
    s.tap(s.find('button', 'picker-not-found-link'));
    expect(s.find('field', 'manual-make-field')).not.toBeNull();
    expect(s.find('view', 'manual-fit-note')).not.toBeNull();
    // The VIN route stays offered next to manual entry.
    expect(s.find('button', 'use-vin-instead')).not.toBeNull();
    expect(s.next()!.props.disabled).toBe(true);
    type(s, 'make', '  Zeekr ');
    type(s, 'model', '001   FR');
    s.tap(s.next());
    const years = s.options('year');
    const thisYear = new Date().getFullYear();
    expect(years[0]).toBe(String(thisYear));
    expect(years).not.toContain(String(thisYear + 1));
    s.choose('year', '2024');
    s.tap(s.next());
    expect(onSubmit).toHaveBeenCalledWith({
      makeId: null, makeName: 'Zeekr', modelId: null, modelName: '001 FR', year: 2024, custom: true,
    });
  });

  test('"Нет в списке" on the model step keeps the picked make and types only the model', () => {
    const onSubmit = vi.fn();
    const s = mount(onSubmit);
    s.choose('make', 'make_kia');
    s.tap(s.find('button', 'picker-not-found-link'));
    expect(s.find('field', 'manual-make-field')).toBeNull();
    type(s, 'model', 'EV9');
    s.tap(s.next());
    s.choose('year', '2025');
    s.tap(s.next());
    expect(onSubmit).toHaveBeenCalledWith({
      makeId: 'make_kia', makeName: 'Kia', modelId: null, modelName: 'EV9', year: 2025, custom: true,
    });
  });

  test('a typed model the catalog lists becomes the listed one, with exact fit', () => {
    const onSubmit = vi.fn();
    const s = mount(onSubmit);
    s.choose('make', 'make_chevrolet');
    s.tap(s.find('button', 'picker-not-found-link'));
    type(s, 'model', '  cobalt ');
    s.tap(s.next());
    expect(s.step()).toBe('year');
    s.choose('year', s.options('year')[0]!);
    s.tap(s.next());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ makeId: 'make_chevrolet', modelId: 'model_cobalt', modelName: 'Cobalt' }));
    expect(onSubmit.mock.calls[0][0].custom).toBeUndefined();
  });

  test('a typed make the catalog lists is picked for the owner, who then types only the model', () => {
    const s = mount();
    s.tap(s.find('button', 'picker-not-found-link'));
    type(s, 'make', 'KIA');
    type(s, 'model', 'EV9');
    s.tap(s.next());
    expect(s.find('field', 'manual-make-field')).toBeNull();
    expect(s.find('field', 'manual-model-field')!.props.value).toBe('EV9');
  });

  test('invalid typed names show field errors and do not move on', () => {
    const s = mount();
    s.tap(s.find('button', 'picker-not-found-link'));
    type(s, 'make', '---');
    type(s, 'model', 'x'.repeat(61));
    s.tap(s.next());
    expect(s.find('field', 'manual-make-field')!.props.errorText).toBe('vehiclePicker.manualError.invalid');
    expect(s.find('field', 'manual-model-field')!.props.errorText).toBe('vehiclePicker.manualError.tooLong');
    expect(s.step()).toBeNull();
  });

  test('back from manual entry returns to the list it was opened from', () => {
    const s = mount();
    s.choose('make', 'make_chevrolet');
    s.tap(s.find('button', 'picker-not-found-link'));
    s.tap(s.back());
    expect(s.step()).toBe('model');
    s.tap(s.back());
    s.tap(s.find('button', 'picker-not-found-link'));
    s.tap(s.back());
    expect(s.step()).toBe('make');
  });

  test('the VIN link is offered on the first step only', () => {
    const s = mount(() => {}, () => {});
    expect(s.find('button', 'use-vin-instead')).not.toBeNull();
    s.choose('make', 'make_chevrolet');
    expect(s.find('button', 'use-vin-instead')).toBeNull();
  });
});
