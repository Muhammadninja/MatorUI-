import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, mockState } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, props, children),
  mockState: {
    authenticated: false,
    addParam: '1' as string | undefined,
    push: vi.fn(),
    setParams: vi.fn(),
  },
}));

vi.mock('expo-router', () => ({
  router: { push: mockState.push, setParams: mockState.setParams },
  useLocalSearchParams: () => ({ add: mockState.addParam }),
}));
vi.mock('react-native', () => ({ RefreshControl: host('refresh-control') }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
vi.mock('lucide-react-native', () => ({ AlertCircle: host('icon') }));
vi.mock('@/components/screens-components/garage/garage-active-hero', () => ({ default: host('active-hero') }));
vi.mock('@/components/screens-components/garage/garage-add-button', () => ({ default: host('garage-add-button') }));
vi.mock('@/components/screens-components/garage/garage-header', () => ({ default: host('garage-header') }));
vi.mock('@/components/screens-components/garage/garage-empty-state', () => ({ default: host('garage-empty-state') }));
vi.mock('@/components/screens-components/garage/garage-quick-actions', () => ({ default: host('quick-actions') }));
vi.mock('@/components/screens-components/garage/garage-vehicle-picker-sheet', () => ({ default: host('vehicle-picker') }));
vi.mock('@/components/screens-components/garage/garage-skeleton', () => ({ default: host('skeleton') }));
vi.mock('@/components/screens-components/garage/garage-switch-row', () => ({ default: host('switch-row') }));
vi.mock('@/components/shared/app-scroll-view/app-scroll-view', () => ({ default: host('scroll-view') }));
vi.mock('@/components/shared/app-view', () => ({ AppView: host('view') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ isAuthenticated: mockState.authenticated }) }));
vi.mock('@/contexts/active-vehicle.context', () => ({ useActiveVehicle: () => ({ setPrimaryVehicle: vi.fn() }) }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/contexts/language.context', () => ({ useLanguageContext: () => ({ language: 'ru' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ success: vi.fn(), danger: vi.fn() }) }));
vi.mock('@/hooks/use-garage', () => ({
  default: () => ({
    state: 'empty',
    vehicles: [],
    primaryVehicle: null,
    secondaryVehicles: [],
    error: null,
    refresh: vi.fn(),
    setPrimary: vi.fn(),
    addVehicle: vi.fn(),
  }),
}));

import GarageScreen from './garage-screen';

function renderGarage() {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<GarageScreen />);
  });
  return renderer;
}

beforeEach(() => {
  mockState.authenticated = false;
  mockState.addParam = '1';
  mockState.push.mockReset();
  mockState.setParams.mockReset();
});

describe('Explore Add Vehicle link into Garage', () => {
  test('guest is sent to the sign-in gate', () => {
    renderGarage();
    expect(mockState.setParams).toHaveBeenCalledWith({ add: undefined });
    expect(mockState.push).toHaveBeenCalledWith('/sign-in?gate=1');
  });

  test('authenticated user gets the Add Vehicle picker', () => {
    mockState.authenticated = true;
    const renderer = renderGarage();
    expect(mockState.push).not.toHaveBeenCalled();
    const picker = renderer.root.find((node) => (node.type as string) === 'vehicle-picker');
    expect(picker.props.visible).toBe(true);
  });

  test('plain Garage navigation does not auto-open the Add Vehicle picker', () => {
    mockState.authenticated = true;
    mockState.addParam = undefined;
    const renderer = renderGarage();
    const picker = renderer.root.find((node) => (node.type as string) === 'vehicle-picker');
    expect(picker.props.visible).toBe(false);
  });
});
