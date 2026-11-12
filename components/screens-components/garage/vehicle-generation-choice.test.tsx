/**
 * The two-option generation picker under the selected-vehicle card: it shows
 * only the backend's options, only for a shared year, and saves the pick on the
 * vehicle (never on the device).
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { Vehicle } from '@/services/garage-service';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, garage, toast } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  garage: { updateVehicle: vi.fn() },
  toast: { danger: vi.fn() },
}));

vi.mock('@/components/shared/app-button/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({ AppView: host('view') }));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: { onVehicleBanner: '#0B2B2A' } }),
}));
vi.mock('@/hooks/use-garage', () => ({ useGarage: () => garage }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => toast }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: object) => (o ? `${key} ${JSON.stringify(o)}` : key) }),
}));

const { default: VehicleGenerationChoice } = await import('./vehicle-generation-choice');

const OPTIONS = [
  { id: 'nexia-2', name: 'Nexia 2', yearFrom: 2008, yearTo: 2016 },
  { id: 'nexia-3', name: 'Nexia 3', yearFrom: 2016, yearTo: 2022 },
];

const vehicle = (generation: Vehicle['generation']): Vehicle =>
  ({ id: 'veh_1', make: 'Chevrolet', model: 'Nexia', year: 2016, modelId: 'nexia', generation }) as Vehicle;

function render(v: Vehicle) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<VehicleGenerationChoice vehicle={v} />);
  });
  return tree;
}

const buttons = (tree: ReactTestRenderer) => tree.root.findAllByType('button' as never);

describe('VehicleGenerationChoice', () => {
  beforeEach(() => {
    garage.updateVehicle.mockReset();
    toast.danger.mockReset();
  });

  test.each([
    ['no generation (other models, older backend)', undefined],
    ['a year-resolved generation', { status: 'resolved', source: 'year', model: { id: 'nexia-3', name: 'Nexia 3' }, options: [] }],
    ['an owner pick already saved', { status: 'resolved', source: 'owner', model: { id: 'nexia-3', name: 'Nexia 3' }, options: OPTIONS }],
    ['an unsupported year', { status: 'unresolved', source: null, model: null, options: [] }],
  ] as const)('renders nothing for %s', (_label, generation) => {
    expect(render(vehicle(generation as Vehicle['generation'])).toJSON()).toBeNull();
  });

  test('offers exactly the backend options, with their build years, and says it is picture-only', () => {
    const tree = render(vehicle({ status: 'choice_required', source: null, model: null, options: OPTIONS }));
    expect(buttons(tree).map((b) => b.props.title)).toEqual(['Nexia 2 · 2008–2016', 'Nexia 3 · 2016–2022']);
    const copy = tree.root.findAllByType('text' as never).map((t) => t.props.children);
    expect(copy).toEqual(['vehicleGeneration.title {"model":"Nexia"}', 'vehicleGeneration.body {"year":2016}']);
  });

  test('saves the pick on the vehicle and locks the options while saving', async () => {
    let finish!: () => void;
    garage.updateVehicle.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const tree = render(vehicle({ status: 'choice_required', source: null, model: null, options: OPTIONS }));
    await act(async () => buttons(tree)[1].props.onPress());
    expect(garage.updateVehicle).toHaveBeenCalledWith('veh_1', { variantModelId: 'nexia-3' });
    expect(buttons(tree).map((b) => [b.props.disabled, b.props.loading])).toEqual([
      [true, false],
      [true, true],
    ]);
    await act(async () => buttons(tree)[0].props.onPress());
    expect(garage.updateVehicle).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(buttons(tree)[0].props.disabled).toBe(false);
  });

  test('a failed save says so and lets the owner try again', async () => {
    garage.updateVehicle.mockRejectedValue(new Error('offline'));
    const tree = render(vehicle({ status: 'choice_required', source: null, model: null, options: OPTIONS }));
    await act(async () => buttons(tree)[0].props.onPress());
    expect(toast.danger).toHaveBeenCalledWith('vehicleGeneration.saveFailed');
    expect(buttons(tree)[0].props.disabled).toBe(false);
  });
});
