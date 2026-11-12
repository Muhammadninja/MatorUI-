/** Unit navigation/state checks; no real API, VIN, or account data. */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';
const state = vi.hoisted(() => ({ canBack: false, back: vi.fn(), replace: vi.fn(), post: vi.fn(), orderState: 'not_found' }));
vi.mock('react-native', () => ({ TextInput: (props: any) => <input {...props} />, ScrollView: ({ children }: any) => <section>{children}</section> }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('expo-router', () => ({ router: { canGoBack: () => state.canBack, back: state.back, replace: state.replace }, useLocalSearchParams: () => ({}), useFocusEffect: () => {} }));
vi.mock('lucide-react-native', () => ({ ArrowLeft: () => null, AlertCircle: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/services/api-client', () => ({ apiClient: { post: state.post } }));
vi.mock('@/hooks/use-orders', () => ({
  useOrder: () => ({ state: state.orderState, order: null, refresh: vi.fn() }),
  useCancelOrder: () => ({ mutate: vi.fn(), isPending: false }),
}));
// Payment recovery is covered separately; these cases have no order to pay.
vi.mock('@/hooks/use-order-payment', () => ({ useRecoverPayment: () => ({ paying: false, failure: null, pay: vi.fn() }) }));
vi.mock('@/components/shared/app-settings-header', () => ({ AppSettingsHeader: () => null }));
vi.mock('@/components/shared/app-view', () => ({ AppView: ({ children, ...props }: any) => <section {...props}>{children}</section>, AppPressableView: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock('@/components/shared/app-text', () => ({ AppText: ({ children }: any) => <span>{children}</span> }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: (props: any) => <button {...props}>{props.title}</button> }));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: () => <span>loading</span> }));
import VinFinderScreen from '@/app/vin-finder';
import TrackOrderScreen from '@/components/screens/track-order-screen';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { vi.clearAllMocks(); state.canBack = false; state.orderState = 'not_found'; });
async function mount(element: React.ReactElement) { let tree!: ReactTestRenderer; await act(async () => { tree = create(element); }); return tree; }
test.each([false, true])('VIN finder has an exit with history=%s', async (history) => {
  state.canBack = history;
  const tree = await mount(<VinFinderScreen />);
  await act(async () => { tree.root.findByProps({ testID: 'vin-finder-back' }).props.onPress(); });
  if (history) { expect(state.back).toHaveBeenCalledTimes(1); expect(state.replace).not.toHaveBeenCalled(); }
  else { expect(state.replace).toHaveBeenCalledWith('/explore'); expect(state.back).not.toHaveBeenCalled(); }
  expect(state.post).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
test('tracking not-found displays a recovery path instead of a blank body or perpetual loader', async () => {
  const tree = await mount(<TrackOrderScreen />);
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain('trackOrder.notFound');
  expect(output).toContain('trackOrder.backToShopping');
  expect(output).not.toContain('loading');
  expect(output).not.toContain('common.retry');
  await act(async () => tree.unmount());
});
