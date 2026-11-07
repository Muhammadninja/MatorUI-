/**
 * Mator's service fee at checkout, through the real screen, hooks and React Query, with only
 * the transports and the cart context standing in. What it guards:
 *   • the fee is the server's figure, shown on its own line before the order is confirmed;
 *   • the total adds the parts, the fee and delivery, and is what the order confirms;
 *   • no total is shown or confirmed while the server's figures are not those of the cart;
 *   • a total the server no longer agrees with is fetched again, never placed.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, transport, cart, replace } = vi.hoisted(() => {
  const h =
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children);
  return {
    host: h,
    transport: {
      listAddresses: vi.fn(),
      getShippingQuote: vi.fn(),
      createOrder: vi.fn(),
      createAddress: vi.fn(),
      updateAddress: vi.fn(),
      getOrder: vi.fn(),
    },
    cart: {
      items: [] as { id: string; title: string; price: string; quantity: number }[],
      pendingIds: new Set<string>(),
      charges: null as null | {
        subtotal: number;
        discount: number;
        serviceFee: number;
        total: number;
      },
      error: null as string | null,
      clearCart: vi.fn(),
      refresh: vi.fn(async () => undefined),
    },
    replace: vi.fn(),
  };
});

vi.mock('react-native', () => ({ ScrollView: host('scroll') }));
vi.mock('expo-linking', () => ({ createURL: () => 'mator://payment-return' }));
vi.mock('expo-router', () => ({ router: { back: vi.fn(), push: vi.fn(), replace } }));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: vi.fn() }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('lucide-react-native', () => ({
  AlertCircle: () => null,
  ArrowLeft: () => null,
  Banknote: () => null,
  Check: () => null,
  CreditCard: () => null,
  MapPin: () => null,
  Wallet: () => null,
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-price', () => ({
  AppPrice: ({ value }: { value: string }) =>
    React.createElement('text', { testID: 'total' }, value),
}));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: host('loader') }));
vi.mock('@/components/screens-components/account/address-form-sheet', () => ({
  default: () => null,
}));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ profile: null }) }));
vi.mock('@/services/pending-payment-storage', () => ({
  loadPendingPayment: vi.fn(async () => null),
  savePendingPayment: vi.fn(async () => undefined),
  clearPendingPayment: vi.fn(async () => undefined),
}));
vi.mock('@/services/garage-service', () => ({ default: { getPrimary: () => null } }));
vi.mock('@/services/payments-service', () => ({
  paymentsTransport: { startPayment: vi.fn(async () => ({ status: 'unsupported' })) },
}));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: transport }));
vi.mock('@/contexts/cart.context', async () => {
  const math = await vi.importActual<typeof import('@/services/cart-math')>('@/services/cart-math');
  return {
    useCartContext: () => {
      const subtotal = math.computeSubtotal(cart.items);
      return {
        items: cart.items,
        totals: math.computeTotals(subtotal, null),
        charges: cart.charges,
        appliedPromo: null,
        pendingIds: cart.pendingIds,
        error: cart.error,
        formatCurrency: math.formatCurrency,
        clearCart: cart.clearCart,
        restoreCart: vi.fn(async () => cart.items),
        refresh: cart.refresh,
      };
    },
  };
});

import CheckoutScreen from '@/components/screens/checkout-screen';
import i18n from '@/services/i18n';

const HOME = {
  id: 'addr_home',
  label: 'Дом',
  line1: 'Навои 1',
  city: 'Ташкент',
  isDefault: true,
  lat: 41.31,
  lng: 69.28,
};
const courier = (price: number) => [{ key: 'courier', label: 'Kuryer', price, quoteId: 'quote_1' }];
/** The brief's order: 600 000 of parts, and the 20 000 fee the server states for it. */
const SERVER = { subtotal: 600_000, discount: 0, serviceFee: 20_000, total: 620_000 };
const nbsp = (text: string) => text.replace(/ /g, ' ');
const settle = () =>
  act(async () => {
    for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('The service fee at checkout', () => {
  let renderer: ReactTestRenderer;

  const texts = () =>
    renderer.root
      .findAll((node) => node.type === 'text')
      .flatMap((node) => node.children.filter((c): c is string => typeof c === 'string'))
      .map(nbsp);
  const allText = () => texts().join(' | ');
  const button = () =>
    renderer.root.find((node) => node.props.testID === 'checkout-place-order-btn');
  const feeRow = () => renderer.root.findAll((node) => node.props.testID === 'order-service-fee');
  const press = async (node: ReactTestInstance) => {
    await act(async () => {
      await node.props.onPress();
    });
    await settle();
  };
  const pressable = (name: string) =>
    renderer.root.find(
      (node) => String(node.type) === 'pressable' && node.props.accessibilityLabel === name,
    );
  const mount = async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <CheckoutScreen />
        </QueryClientProvider>,
      );
    });
    await settle();
  };

  beforeAll(async () => {
    await i18n.changeLanguage('ru');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    cart.items = [{ id: 'part_1', title: 'Колодки', price: '300 000', quantity: 2 }];
    cart.pendingIds = new Set();
    cart.charges = { ...SERVER };
    cart.error = null;
    transport.listAddresses.mockResolvedValue([HOME]);
    transport.getShippingQuote.mockResolvedValue(courier(25_000));
    transport.createOrder.mockResolvedValue({ orderId: 'ord_1', eta: '', totalLabel: '' });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  test('shows the parts, the fee and delivery apart, and a total of all three', async () => {
    await mount();

    expect(allText()).toContain('Стоимость запчастей | 600 000 сум');
    expect(allText()).toContain('Сервисный сбор | 20 000 сум');
    expect(allText()).toContain('Стоимость доставки | 25 000 сум');
    expect(allText()).toContain('Итого к оплате | 645 000 сум');
    expect(nbsp(String(button().props.title))).toBe('Оформить заказ · 645 000 сум');
    expect(button().props.disabled).toBe(false);
  });

  test('confirms exactly that total, and states no fee of its own', async () => {
    await mount();

    await press(button());

    const input = transport.createOrder.mock.calls[0]![0];
    expect(input).toMatchObject({ confirmedTotalUzs: 645_000, confirmedDeliveryUzs: 25_000 });
    expect(input).not.toHaveProperty('serviceFee');
    expect(input).not.toHaveProperty('serviceFeeUzs');
  });

  test('asks the server for its figures on opening, whatever the cart showed before', async () => {
    await mount();

    expect(cart.refresh).toHaveBeenCalled();
  });

  test('no fee, no line for one: the total is the parts and delivery', async () => {
    cart.items = [{ id: 'part_1', title: 'Колодки', price: '90 000', quantity: 1 }];
    cart.charges = { subtotal: 90_000, discount: 0, serviceFee: 0, total: 90_000 };
    await mount();

    expect(feeRow()).toHaveLength(0);
    expect(allText()).not.toContain('Сервисный сбор');
    expect(nbsp(String(button().props.title))).toBe('Оформить заказ · 115 000 сум');
  });

  test('pickup: the parts and the fee, and no delivery cost', async () => {
    await mount();

    await press(pressable('Самовывоз, Бесплатно'));

    expect(allText()).toContain('Стоимость доставки | Бесплатно');
    expect(nbsp(String(button().props.title))).toBe('Оформить заказ · 620 000 сум');
    await press(button());
    expect(transport.createOrder.mock.calls[0]![0]).toMatchObject({
      shippingOptionKey: 'pickup',
      confirmedTotalUzs: 620_000,
    });
  });

  test('while a change to the cart is on its way there is no total, and no order', async () => {
    cart.pendingIds = new Set(['part_1']);
    await mount();

    expect(allText()).toContain('Сервисный сбор | —');
    expect(allText()).toContain('Итого к оплате | —');
    expect(button().props.disabled).toBe(true);
    await press(button());
    expect(transport.createOrder).not.toHaveBeenCalled();
  });

  test('without the server’s figures there is no total, and a way to fetch them', async () => {
    cart.charges = null;
    cart.error = 'offline';
    await mount();

    expect(button().props.disabled).toBe(true);
    expect(allText()).toContain('Не удалось получить суммы заказа.');
    const before = cart.refresh.mock.calls.length;
    await press(pressable('Повторить'));
    expect(cart.refresh.mock.calls.length).toBe(before + 1);
  });

  test('a total the server no longer agrees with: it says so, and fetches the figures again', async () => {
    transport.createOrder.mockRejectedValue(
      Object.assign(new Error('The order total has changed.'), { code: 'ORDER_TOTAL_CHANGED' }),
    );
    await mount();
    const refreshes = cart.refresh.mock.calls.length;
    const quotes = transport.getShippingQuote.mock.calls.length;

    await press(button());

    expect(allText()).toContain(
      'Сумма заказа изменилась. Проверьте итог и подтвердите заказ снова.',
    );
    expect(cart.refresh.mock.calls.length).toBeGreaterThan(refreshes);
    expect(transport.getShippingQuote.mock.calls.length).toBeGreaterThan(quotes);
    expect(cart.clearCart).not.toHaveBeenCalled();
  });
});
