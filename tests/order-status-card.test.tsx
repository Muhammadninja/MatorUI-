/**
 * Where the buyer sees their orders stand: the status card on Home and Profile, and the
 * "My orders" screen with its Active / All tabs. The real hooks, React Query and words, with
 * only the transport standing in. What it guards:
 *   • a cancelled or expired order is never listed;
 *   • the card shows the order that needs the buyer most, in its own words;
 *   • a pickup order that has arrived says where to collect it;
 *   • a buyer with no current order sees no card at all.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, transport, push } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  transport: { listOrders: vi.fn(), getOrder: vi.fn() },
  push: vi.fn(),
}));

vi.mock('react-native', () => ({ ScrollView: host('scroll'), RefreshControl: () => null }));
vi.mock('expo-router', () => ({ useNavigation: () => ({ isFocused: () => true }), useSegments: () => [],
  router: { push, navigate: vi.fn() },
  useFocusEffect: vi.fn(),
}));
vi.mock('lucide-react-native', () => {
  const icon = () => null;
  return {
    AlertCircle: icon,
    ChevronRight: icon,
    Clock: icon,
    MapPin: icon,
    Package: icon,
    PackageCheck: icon,
    PackageOpen: icon,
    Store: icon,
    Timer: icon,
    Truck: icon,
    Wallet: icon,
  };
});
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-price', () => ({
  AppPrice: ({ value }: { value: string }) => React.createElement('text', null, value),
}));
vi.mock('@/components/shared/app-settings-header', () => ({
  AppSettingsHeader: ({ title }: { title: string }) => React.createElement('text', null, title),
}));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: host('loader') }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/contexts/user.context', () => ({
  useUserContext: () => ({ profile: { id: 'user_a' }, isAuthenticated: true, isHydrating: false }),
}));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: transport }));

import OrderHistoryScreen from '@/components/screens/order-history-screen';
import { OrderStatusCard } from '@/components/screens-components/orders/order-status-card';
import i18n from '@/services/i18n';
import type { OrderDetail, OrderListRow } from '@/services/orders-service';

const HOUR = 60 * 60 * 1000;
const row = (id: string, over: Partial<OrderListRow> = {}): OrderListRow => ({
  id,
  date: 'Nov 19, 2026',
  status: 'Processing',
  items: 1,
  total: "100 000 so'm",
  summary: `Колодки ${id}`,
  serverStatus: 'paid',
  paymentType: 'payme',
  deliveryMethod: 'courier',
  ...over,
});
const page = (items: OrderListRow[]) => ({ items, total: items.length, page: 1, pageSize: items.length });
const nbsp = (text: string) => text.replace(/ /g, ' ');
const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('Where the buyer sees their orders stand', () => {
  let renderer: ReactTestRenderer;
  const allText = () =>
    renderer.root
      .findAll((node) => node.type === 'text')
      .flatMap((node) => node.children.filter((c): c is string => typeof c === 'string'))
      .map(nbsp)
      .join(' | ');
  const byTestID = (id: string) =>
    renderer.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
  const mount = async (element: React.ReactElement) => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
    await act(async () => {
      renderer = create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
    });
    await settle();
  };
  const press = async (testID: string) => {
    await act(async () => {
      byTestID(testID)[0]!.props.onPress();
    });
    await settle();
  };

  beforeAll(async () => {
    await i18n.changeLanguage('ru');
  });
  beforeEach(() => {
    vi.clearAllMocks();
    transport.getOrder.mockResolvedValue(null);
  });
  afterEach(() => {
    act(() => renderer.unmount());
  });

  describe('the status card', () => {
    test('is not there without a current order', async () => {
      transport.listOrders.mockResolvedValue(
        page([row('c', { serverStatus: 'cancelled', status: 'Cancelled' }), row('r', { serverStatus: 'refunded' })]),
      );
      await mount(<OrderStatusCard />);

      expect(byTestID('order-status-card')).toHaveLength(0);
    });

    test('shows the unpaid order first, in its own words, and opens it', async () => {
      transport.listOrders.mockResolvedValue(
        page([
          row('ord_shipped', { serverStatus: 'shipped' }),
          row('ord_unpaid', {
            serverStatus: 'pending_payment',
            expiresAt: new Date(Date.now() + HOUR / 4).toISOString(),
          }),
        ]),
      );
      await mount(<OrderStatusCard />);

      expect(byTestID('order-status-row')).toHaveLength(1);
      expect(allText()).toContain('Ожидает оплаты');
      expect(allText()).toContain('Оплатите заказ, пока он не отменился автоматически.');
      expect(byTestID('order-status-deadline')).toHaveLength(1);
      expect(allText()).toContain('Ещё 1 заказ');

      await press('order-status-row');
      expect(push).toHaveBeenCalledWith({ pathname: '/track-order', params: { orderId: 'ord_unpaid' } });

      await press('order-status-card-more');
      expect(push).toHaveBeenLastCalledWith('/order-history');
    });

    test('a cash order waits for confirmation, with no countdown', async () => {
      transport.listOrders.mockResolvedValue(
        page([row('ord_cash', { serverStatus: 'pending_payment', paymentType: 'cash' })]),
      );
      await mount(<OrderStatusCard />);

      expect(allText()).toContain('Ожидает подтверждения');
      expect(byTestID('order-status-deadline')).toHaveLength(0);
      expect(byTestID('order-status-card-more')).toHaveLength(0);
    });

    test('a courier order on its way says the courier is bringing it', async () => {
      transport.listOrders.mockResolvedValue(page([row('ord_1', { serverStatus: 'shipped' })]));
      await mount(<OrderStatusCard />);

      expect(allText()).toContain('Доставляется');
      expect(allText()).toContain('Курьер везёт ваш заказ.');
    });

    test('a pickup order that has arrived says it can be collected, and where', async () => {
      transport.listOrders.mockResolvedValue(
        page([
          row('ord_pickup', {
            serverStatus: 'delivered',
            status: 'Delivered',
            deliveryMethod: 'pickup',
            deliveredAt: new Date(Date.now() - HOUR).toISOString(),
          }),
        ]),
      );
      transport.getOrder.mockResolvedValue({
        id: 'ord_pickup',
        serverStatus: 'delivered',
        status: 'delivered',
        deliveryMethod: 'pickup',
        pickupPoints: [
          {
            dealerId: 'seller_7',
            dealerName: 'Avto Ehtiyot',
            address: 'Sergeli avtobozori, 3-qator 25',
            landmark: null,
            location: null,
            items: [{ id: 'oi_1', partId: 'part_1', title: 'Колодки', quantity: 1 }],
          },
        ],
      } as unknown as OrderDetail);
      await mount(<OrderStatusCard />);

      expect(allText()).toContain('Можно забирать');
      expect(allText()).toContain('Avto Ehtiyot · Sergeli avtobozori, 3-qator 25');
      expect(transport.getOrder).toHaveBeenCalledWith('ord_pickup', expect.anything());
    });

    test('a courier order delivered days ago has left the card', async () => {
      transport.listOrders.mockResolvedValue(
        page([row('ord_1', { serverStatus: 'delivered', deliveredAt: new Date(Date.now() - 5 * 24 * HOUR).toISOString() })]),
      );
      await mount(<OrderStatusCard />);

      expect(byTestID('order-status-card')).toHaveLength(0);
    });
  });

  describe('My orders', () => {
    const ROWS = [
      row('ord_unpaid', { serverStatus: 'pending_payment' }),
      row('ord_cancelled', { serverStatus: 'cancelled', status: 'Cancelled' }),
      row('ord_expired', { serverStatus: 'expired', status: 'Cancelled' }),
      row('ord_delivered', { serverStatus: 'delivered', status: 'Delivered' }),
    ];

    test('is called My orders, and never lists a cancelled or expired order', async () => {
      transport.listOrders.mockResolvedValue(page(ROWS));
      await mount(<OrderHistoryScreen />);

      expect(allText()).toContain('Мои заказы');
      expect(allText()).not.toContain('Колодки ord_cancelled');
      expect(allText()).not.toContain('Колодки ord_expired');
      expect(allText()).not.toContain('Отменён');

      await press('order-history-tab-all');
      expect(allText()).toContain('Колодки ord_delivered');
      expect(allText()).not.toContain('Колодки ord_cancelled');
    });

    test('opens on the active orders when there are some', async () => {
      transport.listOrders.mockResolvedValue(page(ROWS));
      await mount(<OrderHistoryScreen />);

      expect(byTestID('order-history-tab-active')[0]!.props.accessibilityState).toEqual({ selected: true });
      expect(allText()).toContain('Колодки ord_unpaid');
      expect(allText()).toContain('Ожидает оплаты');
      expect(allText()).not.toContain('Колодки ord_delivered');
    });

    test('opens on all orders when nothing is under way', async () => {
      transport.listOrders.mockResolvedValue(page([ROWS[1]!, ROWS[3]!]));
      await mount(<OrderHistoryScreen />);

      expect(byTestID('order-history-tab-all')[0]!.props.accessibilityState).toEqual({ selected: true });
      expect(allText()).toContain('Колодки ord_delivered');

      await press('order-history-tab-active');
      expect(allText()).toContain('Сейчас нет активных заказов.');
    });

    test('with only cancelled orders, says there are none', async () => {
      transport.listOrders.mockResolvedValue(page([ROWS[1]!, ROWS[2]!]));
      await mount(<OrderHistoryScreen />);

      expect(byTestID('order-history-empty')).toHaveLength(1);
      expect(byTestID('order-history-tabs')).toHaveLength(0);
    });
  });
});
