/**
 * The two places an order can be seen outside the checkout. Neither may call an unpaid order
 * a success, and the tracking screen is where an unpaid order can be paid later.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, getOrder, startPayment, openAuthSessionAsync, clearCart, stored, cart } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  getOrder: vi.fn(),
  startPayment: vi.fn(),
  openAuthSessionAsync: vi.fn(),
  clearCart: vi.fn(),
  stored: { record: null as null | Record<string, string> },
  cart: { items: [] as { id: string; quantity: number }[] },
}));

vi.mock('react-native', () => ({ ScrollView: host('scroll') }));
vi.mock('expo-linking', () => ({ createURL: () => 'mator://payment-return' }));
vi.mock('expo-router', () => ({
  router: { push: vi.fn(), navigate: vi.fn(), canDismiss: () => false },
  useLocalSearchParams: () => ({ orderId: 'ord_1' }),
  useFocusEffect: vi.fn(),
}));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('lucide-react-native', () => ({ AlertCircle: () => null, Check: () => null }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-price', () => ({
  AppPrice: ({ value }: { value: string }) => React.createElement('text', null, value),
}));
vi.mock('@/components/shared/app-settings-header', () => ({ AppSettingsHeader: () => null }));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: host('loader') }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({
  profile: { id: 'user_a' }, isAuthenticated: true, isHydrating: false,
}) }));
vi.mock('@/contexts/cart.context', () => ({
  useCartContext: () => ({ items: cart.items, clearCart, restoreCart: vi.fn() }),
}));
vi.mock('@/services/payments-service', () => ({ paymentsTransport: { startPayment } }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: { getOrder } }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('@/services/pending-payment-storage', () => ({
  loadPendingPayment: vi.fn(async () => stored.record),
  savePendingPayment: vi.fn(),
  clearPendingPayment: vi.fn(async () => {
    stored.record = null;
  }),
}));

import OrderConfirmationScreen from '@/components/screens/order-confirmation-screen';
import TrackOrderScreen from '@/components/screens/track-order-screen';
import i18n from '@/services/i18n';
import { PAYMENT_POLL } from '@/services/order-payment';
import type { OrderDetail } from '@/services/orders-service';

const order = (over: Partial<OrderDetail> = {}): OrderDetail => ({
  id: 'ord_1',
  status: 'placed',
  statusLabel: 'Awaiting payment',
  etaWindow: '',
  placedAt: 'Nov 5, 2026',
  steps: [],
  currentStepIndex: 0,
  destination: { id: 'addr_1', label: 'Delivery', line1: '', city: '' },
  courier: null,
  items: [{ id: 'part_1', title: 'Колодки', quantity: 2, price: "100 000 so'm" }],
  totalLabel: "232 500 so'm",
  serverStatus: 'pending_payment',
  paymentType: 'payme',
  ...over,
});
const nbsp = (text: string) => text.replace(/\u00A0/g, ' ');
const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('Screens showing an order', () => {
  let renderer: ReactTestRenderer;
  const allText = () =>
    renderer.root
      .findAll((node) => node.type === 'text')
      .flatMap((node) => node.children.filter((c): c is string => typeof c === 'string'))
      .map(nbsp)
      .join(' | ');
  const payButtons = () =>
    renderer.root.findAll((node) => node.props.testID === 'track-order-pay-btn' && node.type === 'button');
  const mount = async (screen: React.ReactElement) => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    await act(async () => {
      renderer = create(<QueryClientProvider client={client}>{screen}</QueryClientProvider>);
    });
    await settle();
  };

  beforeAll(async () => {
    await i18n.changeLanguage('ru');
    PAYMENT_POLL.delayMs = 0;
  });
  beforeEach(() => {
    vi.clearAllMocks();
    stored.record = null;
    cart.items = [{ id: 'part_1', quantity: 2 }];
  });
  afterEach(() => act(() => renderer.unmount()));

  describe('the confirmation', () => {
    test.each([
      ['a paid order', { serverStatus: 'paid' }],
      ['a cash order waiting for an operator', { paymentType: 'cash' as const }],
      ['a terminal order waiting for an operator', { paymentType: 'terminal' as const }],
    ])('%s is placed', async (_, over) => {
      getOrder.mockResolvedValue(order(over));
      await mount(<OrderConfirmationScreen />);

      expect(allText()).toContain('Заказ оформлен');
    });

    test('an order waiting for online payment is not called a success', async () => {
      getOrder.mockResolvedValue(order());
      await mount(<OrderConfirmationScreen />);

      expect(allText()).not.toContain('Заказ оформлен');
      expect(allText()).toContain('Заказ ждёт оплаты');
    });

    test('shows what the order was placed at, the service fee on its own line', async () => {
      getOrder.mockResolvedValue(
        order({
          serverStatus: 'paid',
          charges: { subtotal: 600_000, discount: 0, serviceFee: 20_000, delivery: 25_000, total: 645_000 },
        }),
      );
      await mount(<OrderConfirmationScreen />);

      expect(allText()).toContain('Стоимость запчастей | 600 000 сум');
      expect(allText()).toContain('Сервисный сбор | 20 000 сум');
      expect(allText()).toContain('Стоимость доставки | 25 000 сум');
    });

    test('an order with no fee shows no line for one', async () => {
      getOrder.mockResolvedValue(
        order({
          serverStatus: 'paid',
          charges: { subtotal: 90_000, discount: 0, serviceFee: 0, delivery: 0, total: 90_000 },
        }),
      );
      await mount(<OrderConfirmationScreen />);

      expect(allText()).toContain('Стоимость запчастей | 90 000 сум');
      expect(allText()).not.toContain('Сервисный сбор');
    });

    test.each(['expired', 'cancelled'])('a %s order is not called a success', async (serverStatus) => {
      getOrder.mockResolvedValue(order({ serverStatus }));
      await mount(<OrderConfirmationScreen />);

      expect(allText()).not.toContain('Заказ оформлен');
      expect(allText()).toContain('Заказ закрыт');
    });
  });

  describe('tracking an order', () => {
    test('shows the fee the order was placed with, apart from the parts and delivery', async () => {
      getOrder.mockResolvedValue(
        order({
          charges: { subtotal: 600_000, discount: 0, serviceFee: 20_000, delivery: 25_000, total: 645_000 },
        }),
      );
      await mount(<TrackOrderScreen />);

      expect(allText()).toContain('Сервисный сбор | 20 000 сум');
      expect(allText()).toContain('Стоимость доставки | 25 000 сум');
    });

    test('an order waiting for online payment can be paid from here', async () => {
      getOrder.mockResolvedValue(order());
      await mount(<TrackOrderScreen />);

      expect(payButtons()).toHaveLength(1);
      expect(nbsp(String(payButtons()[0]!.props.title))).toBe("Оплатить · 232 500 so'm");
    });

    test.each([
      ['cash', { paymentType: 'cash' as const }],
      ['terminal', { paymentType: 'terminal' as const }],
      ['already paid', { serverStatus: 'paid' }],
      ['expired', { serverStatus: 'expired' }],
    ])('%s has nothing to pay', async (_, over) => {
      getOrder.mockResolvedValue(order(over));
      await mount(<TrackOrderScreen />);

      expect(payButtons()).toHaveLength(0);
    });

    test('paying pays that order, and places none', async () => {
      getOrder.mockResolvedValue(order());
      startPayment.mockResolvedValue({ status: 'ready', checkoutUrl: 'https://x' });
      openAuthSessionAsync.mockResolvedValue({ type: 'success' });
      await mount(<TrackOrderScreen />);

      getOrder.mockResolvedValue(order({ serverStatus: 'paid' }));
      await act(async () => {
        await payButtons()[0]!.props.onPress();
      });
      await settle();

      expect(startPayment.mock.calls[0]![0].orderId).toBe('ord_1');
      expect(payButtons()).toHaveLength(0);
    });

    test('a failure says why, and the button stays', async () => {
      getOrder.mockResolvedValue(order());
      startPayment.mockRejectedValue(
        Object.assign(new Error('server words'), { code: 'FISCAL_DATA_INCOMPLETE' }),
      );
      await mount(<TrackOrderScreen />);

      await act(async () => {
        await payButtons()[0]!.props.onPress();
      });
      await settle();

      expect(allText()).toContain('не готовы данные для чека');
      expect(allText()).not.toContain('server words');
      expect(payButtons()).toHaveLength(1);
    });

    test('paying the order the checkout put back in the cart clears that cart', async () => {
      stored.record = { orderId: 'ord_1', totalLabel: '', cartKey: 'part_1:2' };
      getOrder.mockResolvedValue(order());
      startPayment.mockResolvedValue({ status: 'ready', checkoutUrl: 'https://x' });
      openAuthSessionAsync.mockResolvedValue({ type: 'success' });
      await mount(<TrackOrderScreen />);

      getOrder.mockResolvedValue(order({ serverStatus: 'paid' }));
      await act(async () => {
        await payButtons()[0]!.props.onPress();
      });
      await settle();

      expect(clearCart).toHaveBeenCalledTimes(1);
      expect(stored.record).toBeNull();
    });

    test('paying another order leaves the cart alone', async () => {
      stored.record = { orderId: 'ord_other', totalLabel: '', cartKey: 'part_1:2' };
      getOrder.mockResolvedValue(order());
      startPayment.mockResolvedValue({ status: 'ready', checkoutUrl: 'https://x' });
      openAuthSessionAsync.mockResolvedValue({ type: 'success' });
      await mount(<TrackOrderScreen />);

      getOrder.mockResolvedValue(order({ serverStatus: 'paid' }));
      await act(async () => {
        await payButtons()[0]!.props.onPress();
      });
      await settle();

      expect(clearCart).not.toHaveBeenCalled();
      expect(stored.record).toMatchObject({ orderId: 'ord_other' });
    });
  });
});
