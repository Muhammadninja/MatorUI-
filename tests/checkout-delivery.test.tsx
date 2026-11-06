/**
 * The delivery part of the checkout screen, through the real hooks and React Query, with
 * only the transport standing in. What it guards:
 *   • the buyer sees the delivery price and nothing else about the trip;
 *   • an order cannot be placed on a missing, failed or out-of-date price;
 *   • the price follows the address and the cart;
 *   • an address the server cannot price sends the buyer to choose it, wherever they are.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, transport, cart, sheet, replace } = vi.hoisted(() => {
  const h = (type: string) =>
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
      clearCart: vi.fn(),
    },
    sheet: { props: null as null | Record<string, any> },
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
  AppPrice: ({ value }: { value: string }) => React.createElement('text', { testID: 'total' }, value),
}));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: host('loader') }));
vi.mock('@/components/screens-components/account/address-form-sheet', () => ({
  default: (props: Record<string, any>) => {
    sheet.props = props;
    return null;
  },
}));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ profile: null }) }));
vi.mock('@/services/pending-payment-storage', () => ({
  loadPendingPayment: vi.fn(async () => null),
  savePendingPayment: vi.fn(async () => undefined),
  clearPendingPayment: vi.fn(async () => undefined),
}));
vi.mock('@/services/garage-service', () => ({ default: { getPrimary: () => null } }));
// A gateway-less transport: what a failed payment does is in checkout-payment.test.tsx.
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
        // What the server says the cart costs. No fee here: what a fee does is pinned in
        // checkout-service-fee.test.tsx.
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

const HOME = { id: 'addr_home', label: 'Дом', line1: 'Навои 1', city: 'Ташкент', isDefault: true, lat: 41.31, lng: 69.28 };
const WORK = { id: 'addr_work', label: 'Работа', line1: 'Бабура 5', city: 'Ташкент', isDefault: false, lat: 41.29, lng: 69.25 };
const NO_POINT = { id: 'addr_home', label: 'Дом', line1: 'Навои 1', city: 'Ташкент', isDefault: true, lat: null, lng: null };

const courier = (price: number, quoteId = 'quote_1') => [
  { key: 'courier', label: 'Kuryer', price, quoteId },
];
const refusal = (code: string) => Object.assign(new Error(`server words for ${code}`), { code });
const nbsp = (text: string) => text.replace(/ /g, ' ');

/** Settle promises and the React updates they cause. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('What the app holds about routing', () => {
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  const app = ['app', 'components', 'contexts', 'hooks', 'services', 'utils', 'constants', 'config']
    .flatMap(sourceFiles);

  test('nothing in the app calls a routing provider or holds its key', () => {
    expect(app.length).toBeGreaterThan(100);
    const offenders = app.filter((path) => /uzmaps|X-API-Key/i.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });

  test('the checkout itself draws no map', () => {
    expect(readFileSync('components/screens/checkout-screen.tsx', 'utf8')).not.toMatch(
      /react-native-maps|app-map|AppMap/i,
    );
  });

  test('nothing draws a route: the only map chooses where to deliver', () => {
    const offenders = app.filter((path) =>
      /\bPolyline\b|\bDirections\b|routeDistance|api\/route/.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
    const drawsMap = app.filter((path) => /shared\/app-map'/.test(readFileSync(path, 'utf8')));
    expect(drawsMap).toEqual(['components/screens-components/account/delivery-location-picker.tsx']);
  });

  test('no other map library has been added', () => {
    const { dependencies } = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const maps = Object.keys(dependencies).filter((name) => /map(s|box|libre)?\b/i.test(name));
    expect(maps).toEqual(['react-native-maps']);
  });
});

describe('Checkout delivery', () => {
  let renderer: ReactTestRenderer;

  const texts = () =>
    renderer.root
      .findAll((node) => node.type === 'text')
      .flatMap((node) => node.children.filter((c): c is string => typeof c === 'string'))
      .map(nbsp);
  const allText = () => texts().join(' | ');
  const button = () =>
    renderer.root.find((node) => node.props.testID === 'checkout-place-order-btn');
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
  const placeOrder = () => press(button());
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
    cart.items = [{ id: 'part_1', title: 'Колодки', price: '100 000', quantity: 2 }];
    cart.pendingIds = new Set();
    transport.listAddresses.mockResolvedValue([HOME]);
    transport.getShippingQuote.mockResolvedValue(courier(32_500));
    transport.createOrder.mockResolvedValue({ orderId: 'ord_1', eta: '', totalLabel: '' });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  test('shows exactly the delivery price, and adds it to the total', async () => {
    await mount();

    expect(allText()).toContain('Стоимость доставки: 32 500 сум');
    expect(button().props.disabled).toBe(false);
    expect(nbsp(String(button().props.title))).toContain('232 500 сум');
    expect(texts().filter((t) => t === '232 500 сум')).toHaveLength(1);
  });

  test('says nothing else about the trip', async () => {
    await mount();

    expect(allText()).not.toMatch(/\bкм\b|\bkm\b|\bмин\b|\bmin\b|маршрут|route|Сегодня|\bдн\./i);
  });

  test('asks the server for the saved address, stating no coordinates of its own', async () => {
    await mount();

    expect(transport.getShippingQuote.mock.calls[0]![0]).toMatchObject({ addressId: 'addr_home' });
  });

  test('while the price is loading it shows that, offers no zero, and cannot be ordered', async () => {
    transport.getShippingQuote.mockReturnValue(new Promise(() => undefined));
    await mount();

    expect(allText()).toContain('Считаем стоимость доставки…');
    expect(allText()).not.toContain('Бесплатно');
    expect(button().props.disabled).toBe(true);

    await placeOrder();
    expect(transport.createOrder).not.toHaveBeenCalled();
  });

  test('sends the price the buyer saw, and clears the cart once ordered', async () => {
    await mount();

    await placeOrder();

    expect(transport.createOrder.mock.calls[0]![0]).toMatchObject({
      addressId: 'addr_home',
      shippingOptionKey: 'courier',
      confirmedDeliveryUzs: 32_500,
      deliveryQuoteId: 'quote_1',
    });
    expect(cart.clearCart).toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
  });

  describe('a failed quote blocks the order', () => {
    test.each([
      ['DELIVERY_ROUTING_UNAVAILABLE', 'Не удалось рассчитать стоимость доставки. Попробуйте ещё раз.'],
      ['PICKUP_LOCATION_MISSING', 'Эти товары пока нельзя доставить курьером. Можно забрать заказ самовывозом.'],
      ['DELIVERY_ROUTE_NOT_FOUND', 'Не удалось рассчитать доставку до этого адреса. Выберите другой адрес или самовывоз.'],
      ['DELIVERY_ADDRESS_COORDINATES_MISSING', 'Чтобы рассчитать доставку, уточните этот адрес: выберите его из подсказок или укажите точку на карте.'],
      ['COURIER_DELIVERY_UNAVAILABLE', 'Доставка курьером пока недоступна. Можно забрать заказ самовывозом.'],
      ['DELIVERY_OUTSIDE_COVERAGE', 'Этот адрес вне зоны доставки. Выберите другой адрес или самовывоз.'],
    ])('%s, in the app\'s own words', async (code, words) => {
      transport.getShippingQuote.mockRejectedValue(refusal(code));
      await mount();

      expect(allText()).toContain(words);
      expect(allText()).not.toContain('server words');
      expect(allText()).not.toContain('Бесплатно');
      expect(button().props.disabled).toBe(true);
      expect(nbsp(String(button().props.title))).toBe('Оформить заказ');
    });

    test('an answer with no usable price is a failure too, not an endless wait', async () => {
      transport.getShippingQuote.mockResolvedValue([]);
      await mount();

      expect(allText()).not.toContain('Считаем стоимость доставки');
      expect(allText()).toContain('Не удалось рассчитать стоимость доставки');
      expect(allText()).not.toContain('Бесплатно');
      expect(button().props.disabled).toBe(true);
      expect(pressable('Повторить')).toBeDefined();
    });

    test('a passing failure offers a retry, which recovers', async () => {
      transport.getShippingQuote.mockRejectedValueOnce(refusal('DELIVERY_ROUTING_UNAVAILABLE'));
      await mount();
      expect(button().props.disabled).toBe(true);

      await press(pressable('Повторить'));

      expect(allText()).toContain('Стоимость доставки: 32 500 сум');
      expect(button().props.disabled).toBe(false);
    });

    test.each(['PICKUP_LOCATION_MISSING', 'COURIER_DELIVERY_UNAVAILABLE'])(
      'a refusal that would only repeat offers no retry: %s',
      async (code) => {
        transport.getShippingQuote.mockRejectedValue(refusal(code));
        await mount();
        expect(allText()).not.toContain('Повторить');
      },
    );

    test('with couriers off, pickup carries on as ever', async () => {
      transport.getShippingQuote.mockRejectedValue(refusal('COURIER_DELIVERY_UNAVAILABLE'));
      await mount();
      expect(button().props.disabled).toBe(true);

      await press(pressable('Изменить Доставка'));

      expect(allText()).toContain('Самовывоз · Бесплатно');
      expect(button().props.disabled).toBe(false);
      await placeOrder();
      expect(transport.createOrder.mock.calls[0]![0]).toMatchObject({
        shippingOptionKey: 'pickup',
        deliveryQuoteId: null,
      });
    });

    test('a buyer who cannot get a courier can still choose pickup, which costs nothing', async () => {
      transport.getShippingQuote.mockRejectedValue(refusal('PICKUP_LOCATION_MISSING'));
      await mount();

      await press(pressable('Изменить Доставка'));

      expect(allText()).toContain('Самовывоз · Бесплатно');
      expect(button().props.disabled).toBe(false);
      await placeOrder();
      expect(transport.createOrder.mock.calls[0]![0]).toMatchObject({
        shippingOptionKey: 'pickup',
        confirmedDeliveryUzs: null,
        deliveryQuoteId: null,
      });
    });
  });

  describe('an address the server cannot price', () => {
    const CHOOSE = 'Уточнить адрес';
    const located = { ...NO_POINT, lat: 39.65, lng: 66.96 };

    beforeEach(() => {
      transport.listAddresses.mockResolvedValue([NO_POINT]);
      transport.getShippingQuote.mockRejectedValue(refusal('DELIVERY_ADDRESS_COORDINATES_MISSING'));
    });

    test('opens that address to be chosen, and never reads the location itself', async () => {
      await mount();
      expect(sheet.props!.visible).toBe(false);

      await press(pressable(CHOOSE));

      expect(sheet.props!.visible).toBe(true);
      expect(sheet.props!.initial).toMatchObject({ id: 'addr_home' });
      expect(transport.updateAddress).not.toHaveBeenCalled();
    });

    test('the chosen point is saved on that address, and the delivery is priced to it', async () => {
      await mount();
      await press(pressable(CHOOSE));
      transport.updateAddress.mockImplementation(async () => {
        transport.listAddresses.mockResolvedValue([located]);
        transport.getShippingQuote.mockResolvedValue(courier(24_000));
        return located;
      });
      const values = { label: 'Дом', name: '', line1: 'Навои 1', city: 'Ташкент', lat: 39.65, lng: 66.96 };

      await act(async () => {
        await sheet.props!.onSubmit(values);
      });
      await settle();

      expect(transport.updateAddress).toHaveBeenCalledWith('addr_home', values);
      expect(allText()).toContain('Стоимость доставки: 24 000 сум');
      expect(button().props.disabled).toBe(false);
    });

    test('a refused save rejects, so the form can stay open and say why', async () => {
      await mount();
      await press(pressable(CHOOSE));
      transport.updateAddress.mockRejectedValue(refusal('DELIVERY_OUTSIDE_COVERAGE'));

      await expect(
        sheet.props!.onSubmit({ label: 'Дом', name: '', line1: 'Навои 1', city: 'Ташкент', lat: 55.7, lng: 37.6 }),
      ).rejects.toMatchObject({ code: 'DELIVERY_OUTSIDE_COVERAGE' });
      expect(button().props.disabled).toBe(true);
    });

    test.each(['DELIVERY_OUTSIDE_COVERAGE', 'DELIVERY_ROUTE_NOT_FOUND'])(
      '%s can be answered by choosing another point',
      async (code) => {
        transport.getShippingQuote.mockRejectedValue(refusal(code));
        await mount();
        expect(pressable(CHOOSE)).toBeDefined();
      },
    );
  });

  describe('a new address', () => {
    test('is used by the id the server returned, for the quote and then the order', async () => {
      transport.listAddresses.mockResolvedValue([HOME]);
      transport.getShippingQuote.mockImplementation(async ({ addressId }: { addressId: string }) =>
        courier(addressId === 'addr_new' ? 55_000 : 32_500, `quote_${addressId}`),
      );
      await mount();
      const added = { id: 'addr_new', label: 'Работа', line1: 'Бабура 5', city: 'Самарканд', lat: 39.65, lng: 66.96 };
      transport.createAddress.mockImplementation(async () => {
        transport.listAddresses.mockResolvedValue([HOME, added]);
        return added;
      });

      await act(async () => {
        await sheet.props!.onSubmit({ label: 'Работа', name: '', line1: 'Бабура 5', city: 'Самарканд', lat: 39.65, lng: 66.96 });
      });
      await settle();

      expect(transport.getShippingQuote.mock.lastCall![0].addressId).toBe('addr_new');
      expect(allText()).toContain('Стоимость доставки: 55 000 сум');

      await placeOrder();
      expect(transport.createOrder.mock.calls[0]![0]).toMatchObject({
        addressId: 'addr_new',
        confirmedDeliveryUzs: 55_000,
        deliveryQuoteId: 'quote_addr_new',
      });
    });
  });

  describe('the price follows what it depends on', () => {
    test('another address, another quote', async () => {
      transport.listAddresses.mockResolvedValue([HOME, WORK]);
      transport.getShippingQuote.mockImplementation(async ({ addressId }: { addressId: string }) =>
        courier(addressId === 'addr_home' ? 32_500 : 9_000),
      );
      await mount();
      expect(allText()).toContain('Стоимость доставки: 32 500 сум');

      await press(pressable('Изменить адрес'));

      expect(allText()).toContain('Стоимость доставки: 9 000 сум');
      expect(nbsp(String(button().props.title))).toContain('209 000 сум');
    });

    test('other lines in the cart, another quote', async () => {
      await mount();
      expect(transport.getShippingQuote).toHaveBeenCalledTimes(1);

      cart.items = [...cart.items, { id: 'part_2', title: 'Фильтр', price: '50 000', quantity: 1 }];
      transport.getShippingQuote.mockResolvedValue(courier(40_000));
      await act(async () => {
        renderer.update(
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
            <CheckoutScreen />
          </QueryClientProvider>,
        );
      });
      await settle();

      expect(transport.getShippingQuote.mock.lastCall![0].cartKey).toBe('part_1,part_2');
      expect(allText()).toContain('Стоимость доставки: 40 000 сум');
    });

    test('a cart change still on its way to the server holds the quote back', async () => {
      cart.pendingIds = new Set(['part_1']);
      await mount();

      expect(transport.getShippingQuote).not.toHaveBeenCalled();
      expect(button().props.disabled).toBe(true);
    });

    test('no request is made for pickup', async () => {
      await mount();
      transport.getShippingQuote.mockClear();

      await press(pressable('Изменить Доставка'));

      expect(transport.getShippingQuote).not.toHaveBeenCalled();
    });
  });

  describe('the server refusing the price at the last moment', () => {
    test('shows the new price, keeps the cart, and takes the new agreement', async () => {
      await mount();
      transport.createOrder.mockRejectedValueOnce(refusal('DELIVERY_PRICE_CHANGED'));
      transport.getShippingQuote.mockResolvedValue(courier(40_000));

      await placeOrder();
      await settle();

      expect(allText()).toContain('Стоимость доставки изменилась');
      expect(allText()).toContain('Стоимость доставки: 40 000 сум');
      expect(cart.clearCart).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();

      await placeOrder();
      expect(transport.createOrder.mock.lastCall![0].confirmedDeliveryUzs).toBe(40_000);
      expect(cart.clearCart).toHaveBeenCalled();
    });

    test('a quote for a destination since moved: a new quote, handed back with the order', async () => {
      await mount();
      transport.createOrder.mockRejectedValueOnce(refusal('DELIVERY_QUOTE_STALE'));
      transport.getShippingQuote.mockResolvedValue(courier(32_500, 'quote_for_the_new_point'));

      await placeOrder();
      await settle();

      expect(allText()).toContain('Условия доставки изменились');
      expect(cart.clearCart).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();

      await placeOrder();
      expect(transport.createOrder.mock.lastCall![0].deliveryQuoteId).toBe('quote_for_the_new_point');
    });

    test('any other refusal keeps the server message, and the quote alone', async () => {
      await mount();
      transport.getShippingQuote.mockClear();
      transport.createOrder.mockRejectedValueOnce(refusal('PART_UNAVAILABLE'));

      await placeOrder();

      expect(allText()).toContain('server words for PART_UNAVAILABLE');
      expect(transport.getShippingQuote).not.toHaveBeenCalled();
    });
  });

  describe('no address', () => {
    beforeEach(() => {
      transport.listAddresses.mockResolvedValue([]);
    });

    test('an unanswered prompt places nothing', async () => {
      await mount();

      expect(transport.getShippingQuote).not.toHaveBeenCalled();
      expect(button().props.disabled).toBe(true);
    });

    test('skipping it means pickup, says so, and can be ordered', async () => {
      await mount();
      const skip = renderer.root.find(
        (node) => node.type === 'button' && node.props.title === 'Пропустить',
      );

      await press(skip);

      expect(allText()).toContain('Без адреса заказ можно только забрать самовывозом.');
      expect(allText()).toContain('Самовывоз · Бесплатно');
      expect(button().props.disabled).toBe(false);
      await placeOrder();
      expect(transport.createOrder.mock.calls[0]![0]).toMatchObject({
        addressId: null,
        shippingOptionKey: 'pickup',
        confirmedDeliveryUzs: null,
      });
    });
  });
});
