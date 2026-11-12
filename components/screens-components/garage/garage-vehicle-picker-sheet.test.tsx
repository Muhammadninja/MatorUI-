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
  test('opens on makes alone, alphabetical, without makes that are coming soon', () => {
    const s = mount();
    expect(s.step()).toBe('make');
    expect(s.options('make')).toEqual(['make_chevrolet', 'make_kia']);
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

  test('"Не нашли автомобиль?" offers the VIN route and sends nothing', () => {
    const onUseVin = vi.fn();
    const s = mount(() => {}, onUseVin);
    s.tap(s.find('button', 'picker-not-found-link'));
    expect(s.find('view', 'picker-not-found')).not.toBeNull();
    expect(s.step()).toBeNull();
    s.tap(s.find('button', 'use-vin-instead'));
    expect(onUseVin).toHaveBeenCalledTimes(1);
    // Back returns to the step it was opened from.
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
