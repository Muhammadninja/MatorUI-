/** Unit route guards only: synthetic auth and component stubs, no API requests. */
import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const auth = vi.hoisted(() => ({
  profile: null as { id: string } | null, isAuthenticated: false, isHydrating: false,
  push: vi.fn(), mount: vi.fn(), unmount: vi.fn(),
}));
const { host } = vi.hoisted(() => ({ host: (tag: string) =>
  ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => React.createElement(tag, props, children),
}));
vi.mock('expo-router', () => ({ router: { push: auth.push }, Stack: { Screen: host('stack-screen') } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => auth }));
vi.mock('@/components/shared/app-settings-header', () => ({ AppSettingsHeader: host('header') }));
vi.mock('@/components/shared/app-view', () => ({ AppView: host('view') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: host('loader') }));
vi.mock('@/components/screens/order-history-screen', () => ({ default: host('private-screen') }));
vi.mock('@/components/screens/track-order-screen', () => ({ default: host('private-screen') }));
vi.mock('@/components/screens/shipping-addresses-screen', () => ({ default: host('private-screen') }));
vi.mock('@/components/screens/edit-profile-screen', () => ({ default: host('private-screen') }));
vi.mock('@/components/screens/checkout-screen', () => ({ default: host('private-screen') }));
vi.mock('@/components/screens/order-confirmation-screen', () => ({ default: host('private-screen') }));
vi.mock('@/components/screens/vehicle-detail-screen', () => ({ default: host('private-screen') }));
vi.mock('@/components/screens/add-vehicle-screen', () => ({ default: host('private-screen') }));

import { AuthenticatedRoute } from '@/components/screens-components/auth/authenticated-route';
import OrderHistoryRoute from '@/app/order-history';
import TrackOrderRoute from '@/app/track-order';
import NotificationVehicleRoute from '@/app/notification-vehicle';
import ShippingAddressesRoute from '@/app/(tabs)/(profile)/shipping-addresses';
import EditProfileRoute from '@/app/(tabs)/(profile)/edit-profile';
import CheckoutRoute from '@/app/(tabs)/(cart)/checkout';
import OrderConfirmationRoute from '@/app/(tabs)/(cart)/order-confirmation';
import VehicleDetailRoute from '@/app/(tabs)/(garage)/vehicle-detail';
import AddVehicleRoute from '@/app/(tabs)/(garage)/add-vehicle';

beforeEach(() => {
  auth.profile = null; auth.isAuthenticated = false; auth.isHydrating = false;
  vi.clearAllMocks();
});
function PrivateScreen() {
  useEffect(() => { auth.mount(); return () => { auth.unmount(); }; }, []);
  return <React.Fragment>private-data</React.Fragment>;
}
const gate = () => <AuthenticatedRoute titleKey="checkout.title" fallbackHref="/cart"><PrivateScreen /></AuthenticatedRoute>;
async function mount(element: React.ReactElement) {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(element); });
  return tree;
}

test('guest deep link never mounts private children; sign-in opens over the gate', async () => {
  const tree = await mount(gate());
  expect(auth.mount).not.toHaveBeenCalled();
  expect(tree.root.findAll((node) => String(node.type) === 'loader')).toHaveLength(0);
  const button = tree.root.findByProps({ testID: 'authenticated-route-sign-in' });
  expect(button.props.title).toBe('modalHost.continueWithPhone');
  await act(async () => button.props.onPress());
  expect(auth.push).toHaveBeenCalledWith('/sign-in');
  expect(auth.mount).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('restoration waits even if a cached profile is already present', async () => {
  auth.profile = { id: 'account-a' }; auth.isAuthenticated = true; auth.isHydrating = true;
  const tree = await mount(gate());
  expect(tree.root.findAll((node) => String(node.type) === 'loader')).toHaveLength(1);
  expect(tree.root.findAllByType('button')).toHaveLength(0);
  expect(auth.mount).not.toHaveBeenCalled();
  await act(async () => { auth.isHydrating = false; tree.update(gate()); });
  expect(auth.mount).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test('account changes remount private local state and sign-out masks children immediately', async () => {
  auth.profile = { id: 'account-a' }; auth.isAuthenticated = true;
  const tree = await mount(gate());
  expect(auth.mount).toHaveBeenCalledTimes(1);
  await act(async () => { auth.profile = { id: 'account-b' }; tree.update(gate()); });
  expect(auth.unmount).toHaveBeenCalledTimes(1);
  expect(auth.mount).toHaveBeenCalledTimes(2);
  await act(async () => { auth.profile = null; auth.isAuthenticated = false; tree.update(gate()); });
  expect(auth.unmount).toHaveBeenCalledTimes(2);
  expect(tree.root.findByProps({ testID: 'authenticated-route-sign-in' })).toBeDefined();
  await act(async () => tree.unmount());
});

test('an authenticated flag without an account profile cannot mount private children', async () => {
  auth.isAuthenticated = true;
  const tree = await mount(gate());
  expect(auth.mount).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test.each([
  ['order history', OrderHistoryRoute], ['track order', TrackOrderRoute],
  ['shipping addresses', ShippingAddressesRoute], ['edit profile', EditProfileRoute],
  ['checkout', CheckoutRoute], ['order confirmation', OrderConfirmationRoute],
  ['notification vehicle', NotificationVehicleRoute], ['vehicle detail', VehicleDetailRoute], ['add vehicle', AddVehicleRoute],
] as const)('%s route blocks direct guest access and mounts its screen after authentication', async (_name, Route) => {
  const tree = await mount(<Route />);
  expect(tree.root.findAll((node) => String(node.type) === 'private-screen')).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'authenticated-route-sign-in' })).toBeDefined();
  await act(async () => { auth.profile = { id: 'account-a' }; auth.isAuthenticated = true; tree.update(<Route />); });
  expect(tree.root.findAll((node) => String(node.type) === 'private-screen')).toHaveLength(1);
  await act(async () => tree.unmount());
});
