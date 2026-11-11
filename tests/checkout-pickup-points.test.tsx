/**
 * Where a buyer who collects the order goes, on the checkout screen, through the real hooks
 * and React Query with only the transport standing in. What it guards:
 *   • choosing pickup shows the dealer each part is bought from, its address, landmark and
 *     pin, and the goods to collect there, as the backend states them;
 *   • several parts of one dealer make one place, two dealers two, each with its own goods;
 *   • a dealer with no place on record says so, and no point is made up for it;
 *   • the courier is untouched: no pickup request, no pickup section, the same order.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, transport, cart, availability } = vi.hoisted(() => {
  const h =
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children);
  return {
    host: h,
    transport: {
      listAddresses: vi.fn(),
      getShippingQuote: vi.fn(),
      getPickupPoints: vi.fn(),
      createOrder: vi.fn(),
      createAddress: vi.fn(),
      updateAddress: vi.fn(),
      getOrder: vi.fn(),
    },
    cart: {
      items: [] as { id: string; title: string; price: string; quantity: number }[],
      pendingIds: new Set<string>(),
      clearCart: vi.fn(),
    },
    availability: { map: true },
  };
});

vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, ScrollView: host('scroll') }));
vi.mock('expo-linking', () => ({ createURL: () => 'mator://payment-return' }));
vi.mock('expo-router', () => ({ router: { back: vi.fn(), push: vi.fn(), replace: vi.fn() } }));
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
vi.mock('@/components/shared/app-map', () => ({ default: host('map') }));
vi.mock('@/components/screens-components/account/address-form-sheet', () => ({
  default: () => null,
}));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({
  profile: { id: 'user_a' }, isAuthenticated: true, isHydrating: false,
}) }));
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
vi.mock('@/services/order-attempt-storage', () => ({
  loadPendingOrderAttempt: vi.fn(async () => null),
  savePendingOrderAttempt: vi.fn(async () => undefined),
  clearPendingOrderAttempt: vi.fn(async () => undefined),
}));
vi.mock('@/services/delivery-map', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/delivery-map')>();
  return { ...actual, isMapAvailable: () => availability.map };
});
vi.mock('@/contexts/cart.context', async () => {
  const math = await vi.importActual<typeof import('@/services/cart-math')>('@/services/cart-math');
  return {
    useCartContext: () => {
      const subtotal = math.computeSubtotal(cart.items);
      return {
        items: cart.items,
        totals: math.computeTotals(subtotal, null),
        charges: { subtotal, discount: 0, serviceFee: 0, total: subtotal },
        appliedPromo: null,
        pendingIds: cart.pendingIds,
        error: null,
        formatCurrency: math.formatCurrency,
        clearCart: cart.clearCart,
        restoreCart: vi.fn(async () => cart.items),
        refresh: vi.fn(async () => undefined),
      };
    },
  };
});

import CheckoutScreen from '@/components/screens/checkout-screen';
import i18n from '@/services/i18n';
import type { PickupPoint } from '@/services/orders-service';

const HOME = {
  id: 'addr_home',
  label: 'Дом',
  line1: 'Навои 1',
  city: 'Ташкент',
  isDefault: true,
  lat: 41.31,
  lng: 69.28,
};
const COURIER_OPTIONS = [
  { key: 'pickup', label: 'Olib ketish', price: 0, quoteId: null },
  { key: 'courier', label: 'Kuryer', price: 32_500, quoteId: 'quote_1' },
];

const DV: PickupPoint = {
  dealerId: 'drivers-village',
  dealerName: 'Driver’s Village',
  address: 'Toshkent, Bunyodkor shoh ko‘chasi 12',
  landmark: 'Mega Planet qarshisida',
  location: { lat: 41.2851, lng: 69.2045 },
  items: [{ cartItemId: 'ci_1', partId: 'part_1', title: 'Колодки', quantity: 2 }],
};
const AVTO: PickupPoint = {
  dealerId: 'seller_7',
  dealerName: 'Avto Ehtiyot',
  address: 'Sergeli avtobozori, 3-qator 25',
  landmark: null,
  location: { lat: 41.2263, lng: 69.219 },
  items: [{ cartItemId: 'ci_2', partId: 'part_2', title: 'Фильтр', quantity: 1 }],
};

const nbsp = (text: string) => text.replace(/\u00a0/g, ' ');
const settle = () =>
  act(async () => {
    for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('Checkout: where to collect the order', () => {
  let renderer: ReactTestRenderer;

  const hosts = (testID: string) =>
    renderer.root.findAll((node) => typeof node.type === 'string' && node.props.testID === testID);
  const host1 = (testID: string) => {
    const found = hosts(testID);
    expect(found).toHaveLength(1);
    return found[0]!;
  };
  const textsOf = (node: ReactTestInstance) =>
    node
      .findAll((n) => n.type === 'text')
      .map((n) => n.children.filter((c) => typeof c === 'string' || typeof c === 'number').join(''))
      .map(nbsp);
  const allText = () => textsOf(renderer.root).join(' | ');
  const cards = () => hosts('checkout-pickup-point');
  const maps = () => renderer.root.findAll((node) => node.type === 'map');
  const press = async (node: ReactTestInstance) => {
    await act(async () => {
      await node.props.onPress();
    });
    await settle();
  };
  const choose = (testID: string) => press(host1(testID));
  const skipAddress = () =>
    press(
      renderer.root.find(
        (node) => node.type === 'button' && node.props.title === i18n.t('checkout.skip'),
      ),
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
    availability.map = true;
    cart.items = [{ id: 'part_1', title: 'Колодки', price: '100 000', quantity: 2 }];
    cart.pendingIds = new Set();
    transport.listAddresses.mockResolvedValue([]);
    transport.getShippingQuote.mockResolvedValue(COURIER_OPTIONS);
    transport.getPickupPoints.mockResolvedValue([DV]);
    transport.createOrder.mockResolvedValue({ orderId: 'ord_1', eta: '', totalLabel: '' });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  test("one dealer's part: its name, address, landmark and pin, and the goods to collect", async () => {
    await mount();
    await skipAddress();

    expect(transport.getPickupPoints).toHaveBeenCalledTimes(1);
    expect(transport.getShippingQuote).not.toHaveBeenCalled();
    const [card] = cards();
    expect(cards()).toHaveLength(1);
    expect(textsOf(card!)).toEqual([
      'Driver’s Village',
      'Toshkent, Bunyodkor shoh ko‘chasi 12',
      'Ориентир: Mega Planet qarshisida',
      'Колодки × 2',
    ]);
    // The dealer's own point, exactly, on the existing map: one pin, nothing else on it.
    const [map] = maps();
    expect(maps()).toHaveLength(1);
    expect(map!.props.markers).toEqual([
      {
        id: 'drivers-village',
        coordinate: { latitude: 41.2851, longitude: 69.2045 },
        title: 'Driver’s Village',
      },
    ]);
    expect(map!.props.initialRegion).toMatchObject({ latitude: 41.2851, longitude: 69.2045 });
    expect(map!.props.scrollEnabled).toBe(false);
    expect(map!.props.zoomEnabled).toBe(false);
    expect(allText()).toContain('Где забрать заказ');
    expect(hosts('checkout-pickup-gap')).toHaveLength(0);
  });

  test('several parts of one dealer: one place, its address once, every part under it', async () => {
    cart.items = [
      { id: 'part_1', title: 'Колодки', price: '100 000', quantity: 2 },
      { id: 'part_3', title: 'Ремень', price: '50 000', quantity: 1 },
    ];
    transport.getPickupPoints.mockResolvedValue([
      {
        ...DV,
        items: [
          { cartItemId: 'ci_1', partId: 'part_1', title: 'Колодки', quantity: 2 },
          { cartItemId: 'ci_3', partId: 'part_3', title: 'Ремень', quantity: 1 },
        ],
      },
    ]);
    await mount();
    await skipAddress();

    expect(cards()).toHaveLength(1);
    expect(maps()).toHaveLength(1);
    expect(allText().split('Toshkent, Bunyodkor shoh ko‘chasi 12')).toHaveLength(2);
    expect(hosts('checkout-pickup-item').map((n) => textsOf(n).join(''))).toEqual([
      'Колодки × 2',
      'Ремень × 1',
    ]);
  });

  test("two dealers: a place each, with only that dealer's goods and pin", async () => {
    cart.items = [
      { id: 'part_1', title: 'Колодки', price: '100 000', quantity: 2 },
      { id: 'part_2', title: 'Фильтр', price: '50 000', quantity: 1 },
    ];
    transport.getPickupPoints.mockResolvedValue([DV, AVTO]);
    await mount();
    await skipAddress();

    const [dv, avto] = cards();
    expect(cards()).toHaveLength(2);
    expect(textsOf(dv!)).toEqual([
      'Driver’s Village',
      'Toshkent, Bunyodkor shoh ko‘chasi 12',
      'Ориентир: Mega Planet qarshisida',
      'Колодки × 2',
    ]);
    expect(textsOf(avto!)).toEqual([
      'Avto Ehtiyot',
      'Sergeli avtobozori, 3-qator 25',
      'Фильтр × 1',
    ]);
    expect(maps().map((map) => map.props.markers[0].coordinate)).toEqual([
      { latitude: 41.2851, longitude: 69.2045 },
      { latitude: 41.2263, longitude: 69.219 },
    ]);
  });

  test('shows only the places the backend names: no other dealer, no list of addresses', async () => {
    await mount();
    await skipAddress();

    expect(hosts('checkout-pickup-dealer').map((n) => textsOf(n).join(''))).toEqual([
      'Driver’s Village',
    ]);
    expect(allText()).not.toContain('Avto Ehtiyot');
  });

  describe('a place not on record yet', () => {
    test('neither address nor coordinates: says the pickup point is not specified, and draws no point', async () => {
      transport.getPickupPoints.mockResolvedValue([
        { ...DV, address: null, landmark: null, location: null },
      ]);
      await mount();
      await skipAddress();

      expect(maps()).toHaveLength(0);
      expect(hosts('checkout-pickup-coordinates')).toHaveLength(0);
      expect(textsOf(host1('checkout-pickup-gap'))).toEqual(['Точка самовывоза пока не указана']);
      expect(textsOf(host1('checkout-pickup-point'))).toEqual([
        'Driver’s Village',
        'Точка самовывоза пока не указана',
        'Колодки × 2',
      ]);
    });

    test('an address with no coordinates: the address, no pin, and that the map point is missing', async () => {
      transport.getPickupPoints.mockResolvedValue([{ ...DV, landmark: null, location: null }]);
      await mount();
      await skipAddress();

      expect(maps()).toHaveLength(0);
      expect(allText()).toContain('Toshkent, Bunyodkor shoh ko‘chasi 12');
      expect(textsOf(host1('checkout-pickup-gap'))).toEqual(['Точка на карте пока не указана']);
    });

    test('coordinates with no address: the pin, and that the address is missing', async () => {
      transport.getPickupPoints.mockResolvedValue([{ ...DV, address: null, landmark: null }]);
      await mount();
      await skipAddress();

      expect(maps()).toHaveLength(1);
      expect(textsOf(host1('checkout-pickup-gap'))).toEqual(['Адрес пока не указан']);
    });

    test('a dealer that is not known is named as such', async () => {
      transport.getPickupPoints.mockResolvedValue([
        { ...DV, dealerId: null, dealerName: null, address: null, landmark: null, location: null },
      ]);
      await mount();
      await skipAddress();

      expect(textsOf(host1('checkout-pickup-dealer'))).toEqual(['Продавец не определён']);
    });
  });

  test('a build that cannot draw a map shows the coordinates instead', async () => {
    availability.map = false;
    await mount();
    await skipAddress();

    expect(maps()).toHaveLength(0);
    expect(textsOf(host1('checkout-pickup-coordinates'))).toEqual([
      'Координаты: 41.285100, 69.204500',
    ]);
  });

  test('while it loads it says so; a failure says so and can be retried', async () => {
    transport.getPickupPoints.mockReturnValueOnce(new Promise(() => undefined));
    await mount();
    await skipAddress();
    expect(textsOf(host1('checkout-pickup-loading'))).toEqual(['Загружаем адрес самовывоза…']);
    act(() => renderer.unmount());

    transport.getPickupPoints.mockRejectedValueOnce(new Error('offline'));
    await mount();
    await skipAddress();
    expect(textsOf(host1('checkout-pickup-error'))).toContain(
      'Не удалось загрузить адрес самовывоза.',
    );

    const retry = hosts('checkout-pickup-error')[0]!.find(
      (node) =>
        String(node.type) === 'pressable' &&
        node.props.accessibilityLabel === i18n.t('common.retry'),
    );
    await press(retry);
    expect(cards()).toHaveLength(1);
  });

  test('a pickup order is placed exactly as before: pickup, no price, no quote', async () => {
    await mount();
    await skipAddress();

    await press(
      renderer.root.find(
        (node) => node.props.testID === 'checkout-place-order-btn' && node.type === 'button',
      ),
    );

    expect(transport.createOrder).toHaveBeenCalledTimes(1);
    expect(transport.createOrder.mock.calls[0]![0]).toMatchObject({
      addressId: null,
      shippingOptionKey: 'pickup',
      confirmedDeliveryUzs: null,
      deliveryQuoteId: null,
    });
    expect(JSON.stringify(transport.createOrder.mock.calls[0]![0])).not.toMatch(
      /Bunyodkor|41\.2851|drivers-village/,
    );
  });

  describe('the courier', () => {
    beforeEach(() => {
      transport.listAddresses.mockResolvedValue([HOME]);
    });

    test('chosen, it shows no pickup place and asks for none; the order is the courier one as before', async () => {
      await mount();

      expect(transport.getPickupPoints).not.toHaveBeenCalled();
      expect(hosts('checkout-pickup-points')).toHaveLength(0);
      expect(maps()).toHaveLength(0);

      await press(
        renderer.root.find(
          (node) => node.props.testID === 'checkout-place-order-btn' && node.type === 'button',
        ),
      );
      expect(transport.createOrder.mock.calls[0]![0]).toMatchObject({
        addressId: 'addr_home',
        shippingOptionKey: 'courier',
        confirmedDeliveryUzs: 32_500,
        deliveryQuoteId: 'quote_1',
      });
      expect(transport.getPickupPoints).not.toHaveBeenCalled();
    });

    test('switching to pickup shows the place, and back to the courier hides it again', async () => {
      await mount();

      await choose('checkout-delivery-pickup');
      expect(cards()).toHaveLength(1);
      expect(transport.getPickupPoints).toHaveBeenCalledTimes(1);

      await choose('checkout-delivery-courier-option');
      expect(cards()).toHaveLength(0);
      expect(maps()).toHaveLength(0);
      expect(textsOf(host1('checkout-delivery-courier'))).toEqual(['Курьер Mator', '32 500 сум']);
    });
  });
});
