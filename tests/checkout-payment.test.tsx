/**
 * When a Payme payment does not go through. The real checkout screen, hooks, payment logic
 * and React Query, with only the transports and the browser standing in. What it guards:
 *   • no confirmation without the backend saying the order is paid;
 *   • the cart is kept, and only ever cleared by a real payment;
 *   • a retry pays the same order, so there is one order however many attempts it takes;
 *   • coming back later finds that order rather than placing another.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, transport, cart, startPayment, openAuthSessionAsync, replace, push, stored } = vi.hoisted(() => {
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
      clearCart: vi.fn(),
      restoreCart: vi.fn(),
    },
    startPayment: vi.fn(),
    openAuthSessionAsync: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
    stored: { record: null as null | Record<string, string> },
  };
});

vi.mock('react-native', () => ({ ScrollView: host('scroll') }));
vi.mock('expo-linking', () => ({ createURL: () => 'mator://payment-return' }));
vi.mock('expo-router', () => ({ router: { back: vi.fn(), push, replace } }));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync }));
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
vi.mock('@/components/screens-components/account/address-form-sheet', () => ({ default: () => null }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ profile: { id: 'user_a' } }) }));
vi.mock('@/services/garage-service', () => ({ default: { getPrimary: () => null } }));
vi.mock('@/services/payments-service', () => ({ paymentsTransport: { startPayment } }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: transport }));
vi.mock('@/services/pending-payment-storage', () => ({
  loadPendingPayment: vi.fn(async () => stored.record),
  savePendingPayment: vi.fn(async (_: unknown, record: Record<string, string>) => {
    stored.record = record;
  }),
  clearPendingPayment: vi.fn(async () => {
    stored.record = null;
  }),
}));
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
        pendingIds: new Set<string>(),
        error: null,
        formatCurrency: math.formatCurrency,
        clearCart: cart.clearCart,
        restoreCart: cart.restoreCart,
        refresh: vi.fn(async () => undefined),
      };
    },
  };
});

import CheckoutScreen from '@/components/screens/checkout-screen';
import i18n from '@/services/i18n';
import { PAYMENT_POLL } from '@/services/order-payment';

const HOME = { id: 'addr_home', label: 'Дом', line1: 'Навои 1', city: 'Ташкент', isDefault: true, lat: 41.31, lng: 69.28 };
const LINES = [{ id: 'part_1', title: 'Колодки', price: '100 000', quantity: 2 }];
const CART_KEY = 'part_1:2';
const LINK = { status: 'ready', checkoutUrl: 'https://checkout.paycom.uz/abc' };

const order = (serverStatus: string, paymentType = 'payme') => ({
  id: 'ord_1',
  serverStatus,
  paymentType,
  totalLabel: "232 500 so'm",
  items: [{ id: 'part_1', title: 'Колодки', quantity: 2, price: "100 000 so'm" }],
});
const refusal = (code: string) => Object.assign(new Error(`server words for ${code}`), { code });
const nbsp = (text: string) => text.replace(/\u00A0/g, ' ');
const settle = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('Paying for an order at checkout', () => {
  let renderer: ReactTestRenderer;

  const allText = () =>
    renderer.root
      .findAll((node) => node.type === 'text')
      .flatMap((node) => node.children.filter((c): c is string => typeof c === 'string'))
      .map(nbsp)
      .join(' | ');
  const button = () => renderer.root.find((node) => node.props.testID === 'checkout-place-order-btn');
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
  const exists = (id: string) =>
    renderer.root.findAll((node) => node.props.testID === id && typeof node.type === 'string').length > 0;
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
  /** Mount and place the order, as a buyer paying by Payme, the default. */
  const placeWithPayme = async () => {
    await mount();
    await press(button());
  };

  beforeAll(async () => {
    await i18n.changeLanguage('ru');
    PAYMENT_POLL.delayMs = 0;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    stored.record = null;
    cart.items = LINES;
    cart.restoreCart.mockImplementation(async () => cart.items);
    transport.listAddresses.mockResolvedValue([HOME]);
    transport.getShippingQuote.mockResolvedValue([
      { key: 'courier', label: 'Kuryer', price: 32_500, quoteId: 'quote_1' },
    ]);
    transport.createOrder.mockResolvedValue({ orderId: 'ord_1', eta: '', totalLabel: "232 500 so'm" });
    transport.getOrder.mockResolvedValue(order('paid'));
    startPayment.mockResolvedValue(LINK);
    openAuthSessionAsync.mockResolvedValue({ type: 'success' });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  describe('a payment that works', () => {
    test('goes from the order to the page to the confirmation, and clears the cart', async () => {
      await placeWithPayme();

      expect(transport.createOrder).toHaveBeenCalledTimes(1);
      expect(startPayment.mock.calls[0]![0]).toMatchObject({ orderId: 'ord_1', provider: 'payme' });
      expect(openAuthSessionAsync).toHaveBeenCalledTimes(1);
      expect(cart.clearCart).toHaveBeenCalledTimes(1);
      expect(cart.restoreCart).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith({
        pathname: '/order-confirmation',
        params: { orderId: 'ord_1' },
      });
      expect(stored.record).toBeNull();
    });

    test('says nothing went wrong', async () => {
      await placeWithPayme();
      expect(allText()).not.toContain('Оплата не прошла');
      expect(allText()).not.toContain('не оплачен');
    });
  });

  describe.each([
    ['failed fiscalization', 'FISCAL_DATA_INCOMPLETE', 'Оплата не прошла', 'не готовы данные для чека'],
    ['parts no longer sold', 'PART_UNAVAILABLE', 'Оплата не прошла', 'Часть товаров больше недоступна'],
    ['no connection', 'NETWORK', 'Оплата не прошла', 'Не удалось начать оплату'],
    ['a server error', 'HTTP_500', 'Оплата не прошла', 'Не удалось начать оплату'],
    ['no payment link', 'PAYMENT_LINK_MISSING', 'Оплата не прошла', 'Не удалось начать оплату'],
  ])('payment refused: %s', (_, code, title, words) => {
    beforeEach(() => {
      startPayment.mockRejectedValue(refusal(code));
      transport.getOrder.mockResolvedValue(order('pending_payment'));
    });

    test('shows no confirmation, and keeps the cart', async () => {
      await placeWithPayme();

      expect(replace).not.toHaveBeenCalled();
      expect(cart.clearCart).not.toHaveBeenCalled();
      expect(cart.restoreCart).toHaveBeenCalled();
      expect(openAuthSessionAsync).not.toHaveBeenCalled();
    });

    test('says what happened, in the app\'s own words', async () => {
      await placeWithPayme();

      expect(allText()).toContain(title);
      expect(allText()).toContain(words);
      expect(allText()).not.toContain('server words');
    });
  });

  describe.each([
    ['the buyer closes the page', 'dismiss', 'Заказ ещё не оплачен', 'Оплата не завершена'],
    ['the buyer cancels', 'cancel', 'Заказ ещё не оплачен', 'Оплата не завершена'],
    ['the page returns, unconfirmed', 'success', 'Заказ ещё не оплачен', 'Подтверждение оплаты ещё не пришло'],
  ])('%s', (_, type, title, words) => {
    beforeEach(() => {
      openAuthSessionAsync.mockResolvedValue({ type });
      transport.getOrder.mockResolvedValue(order('pending_payment'));
    });

    test('is not a success: no confirmation, and the cart stays', async () => {
      await placeWithPayme();

      expect(replace).not.toHaveBeenCalled();
      expect(cart.clearCart).not.toHaveBeenCalled();
      expect(allText()).toContain(title);
      expect(allText()).toContain(words);
    });
  });

  describe('after a failure', () => {
    beforeEach(() => {
      startPayment.mockRejectedValue(refusal('FISCAL_DATA_INCOMPLETE'));
      transport.getOrder.mockResolvedValue(order('pending_payment'));
    });

    test('the button pays that order, at what it charges', async () => {
      await placeWithPayme();

      expect(nbsp(String(button().props.title))).toBe("Повторить оплату · 232 500 so'm");
      expect(button().props.disabled).toBe(false);
      expect(allText()).toContain('Колодки');
      expect(allText()).toContain("232 500 so'm");
      expect(allText()).not.toContain('сум');
    });

    test('a retry places no second order: same order, however many tries', async () => {
      await placeWithPayme();
      await press(button());
      await press(button());

      expect(transport.createOrder).toHaveBeenCalledTimes(1);
      expect(startPayment).toHaveBeenCalledTimes(3);
      for (const [input] of startPayment.mock.calls) expect(input.orderId).toBe('ord_1');
    });

    test('a retry that works reaches the confirmation and clears the cart', async () => {
      await placeWithPayme();
      startPayment.mockResolvedValue(LINK);
      transport.getOrder.mockResolvedValue(order('paid'));

      await press(button());

      expect(transport.createOrder).toHaveBeenCalledTimes(1);
      expect(cart.clearCart).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith({
        pathname: '/order-confirmation',
        params: { orderId: 'ord_1' },
      });
      expect(stored.record).toBeNull();
    });

    test('while a retry runs the button cannot be pressed again', async () => {
      await placeWithPayme();
      let release!: (value: unknown) => void;
      startPayment.mockReturnValue(new Promise((resolve) => (release = resolve)));

      let pressing!: Promise<void>;
      await act(async () => {
        pressing = button().props.onPress();
      });

      expect(button().props.disabled).toBe(true);
      expect(nbsp(String(button().props.title))).toBe('Оплата…');
      await act(async () => {
        release(LINK);
        await pressing;
      });
    });

    test('the choices already made are not offered, since they cannot change this order', async () => {
      await placeWithPayme();

      expect(exists('checkout-delivery-card')).toBe(false);
      expect(allText()).not.toContain('Наличные');
      expect(transport.getShippingQuote).toHaveBeenCalledTimes(1);
    });

    test('the buyer can open the order to recover it later', async () => {
      await placeWithPayme();

      await press(pressable('Посмотреть заказ'));

      expect(push).toHaveBeenCalledWith({ pathname: '/track-order', params: { orderId: 'ord_1' } });
    });

    test('a webhook arriving while they look moves them on, without doing anything', async () => {
      startPayment.mockResolvedValue(LINK);
      openAuthSessionAsync.mockResolvedValue({ type: 'dismiss' });
      // Reads during the attempt say unpaid. The first read on screen says paid.
      const reads = [order('pending_payment'), order('pending_payment')];
      transport.getOrder.mockImplementation(async () => reads.shift() ?? order('paid'));

      await placeWithPayme();
      await settle();

      expect(cart.clearCart).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith({
        pathname: '/order-confirmation',
        params: { orderId: 'ord_1' },
      });
    });

    test('an order that expires while they look returns them to the checkout, cart intact', async () => {
      await placeWithPayme();
      expect(exists('checkout-payment-failed')).toBe(true);

      transport.getOrder.mockResolvedValue(order('expired'));
      startPayment.mockRejectedValue(refusal('BAD_REQUEST'));
      await press(button());

      expect(exists('checkout-payment-failed')).toBe(false);
      expect(exists('checkout-order-closed')).toBe(true);
      expect(cart.clearCart).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(stored.record).toBeNull();
    });
  });

  describe('giving up on the unpaid order', () => {
    beforeEach(() => {
      startPayment.mockRejectedValue(refusal('FISCAL_DATA_INCOMPLETE'));
      transport.getOrder.mockResolvedValue(order('pending_payment'));
    });

    test('is the buyer\'s choice, and returns them to a working checkout', async () => {
      await placeWithPayme();

      await press(pressable('Оформить заказ заново'));

      expect(exists('checkout-payment-failed')).toBe(false);
      expect(allText()).toContain('Курьер Mator | 32 500 сум');
      expect(nbsp(String(button().props.title))).toBe('Оформить заказ · 232 500 сум');
      expect(transport.createOrder).toHaveBeenCalledTimes(1);
      expect(stored.record).toBeNull();
    });

    test('says the unpaid order goes away by itself', async () => {
      await placeWithPayme();
      expect(allText()).toContain('Неоплаченный заказ отменится автоматически.');
    });

    test('then another payment method can be used, as a new order', async () => {
      await placeWithPayme();
      await press(pressable('Оформить заказ заново'));
      await press(pressable('Наличные'));
      transport.createOrder.mockResolvedValue({ orderId: 'ord_2', eta: '', totalLabel: '' });

      await press(button());

      expect(transport.createOrder).toHaveBeenCalledTimes(2);
      expect(transport.createOrder.mock.lastCall![0].paymentType).toBe('cash');
      expect(startPayment).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith({
        pathname: '/order-confirmation',
        params: { orderId: 'ord_2' },
      });
    });
  });

  describe('coming back to the checkout later', () => {
    const RECORD = { orderId: 'ord_1', totalLabel: "232 500 so'm", cartKey: CART_KEY };

    test('an order still unpaid is offered, and pressing the button cannot place another', async () => {
      stored.record = RECORD;
      transport.getOrder.mockResolvedValue(order('pending_payment'));
      await mount();

      expect(exists('checkout-payment-failed')).toBe(true);
      expect(allText()).toContain('Этот заказ ждёт оплаты');

      await press(button());

      expect(transport.createOrder).not.toHaveBeenCalled();
      expect(startPayment.mock.calls[0]![0].orderId).toBe('ord_1');
    });

    test('nothing can be placed until that has been checked', async () => {
      stored.record = RECORD;
      let answer!: (value: unknown) => void;
      transport.getOrder.mockReturnValue(new Promise((resolve) => (answer = resolve)));
      await mount();

      expect(button().props.disabled).toBe(true);
      await act(async () => {
        answer(order('pending_payment'));
      });
      await settle();
    });

    test('a failed read still offers that order, rather than risk a second one', async () => {
      stored.record = RECORD;
      transport.getOrder.mockRejectedValue(new Error('offline'));
      await mount();

      expect(exists('checkout-payment-failed')).toBe(true);
      await press(button());
      expect(transport.createOrder).not.toHaveBeenCalled();
    });

    test('an order paid meanwhile, from this same cart, is finished with', async () => {
      stored.record = RECORD;
      transport.getOrder.mockResolvedValue(order('paid'));
      await mount();

      expect(cart.clearCart).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith({
        pathname: '/order-confirmation',
        params: { orderId: 'ord_1' },
      });
      expect(stored.record).toBeNull();
    });

    test('an order paid meanwhile does not touch a cart since changed: that is another purchase', async () => {
      stored.record = { ...RECORD, cartKey: 'other_part:1' };
      transport.getOrder.mockResolvedValue(order('paid'));
      await mount();

      expect(cart.clearCart).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(exists('checkout-payment-failed')).toBe(false);
      expect(stored.record).toBeNull();
    });

    test('an order expired meanwhile is forgotten', async () => {
      stored.record = RECORD;
      transport.getOrder.mockResolvedValue(order('expired'));
      await mount();

      expect(exists('checkout-payment-failed')).toBe(false);
      expect(stored.record).toBeNull();
      expect(button().props.disabled).toBe(false);
    });

    test('paying the old order does not clear a cart since changed', async () => {
      stored.record = { ...RECORD, cartKey: 'other_part:1' };
      transport.getOrder.mockResolvedValue(order('pending_payment'));
      await mount();

      transport.getOrder.mockResolvedValue(order('paid'));
      await press(button());

      expect(cart.clearCart).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalled();
    });

    test('a record is written before the payment starts, so a crash cannot lead to a second order', async () => {
      let atStart: unknown = 'not read';
      startPayment.mockImplementation(async () => {
        atStart = stored.record;
        return LINK;
      });

      await placeWithPayme();

      expect(atStart).toMatchObject({ orderId: 'ord_1', cartKey: CART_KEY });
    });
  });

  describe('cash and terminal', () => {
    test.each(['Наличные', 'Терминал'])('%s has no online step at all', async (name) => {
      await mount();
      await press(pressable(name));

      await press(button());

      expect(startPayment).not.toHaveBeenCalled();
      expect(openAuthSessionAsync).not.toHaveBeenCalled();
      expect(cart.clearCart).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalled();
      expect(stored.record).toBeNull();
    });
  });

  test('a mock transport with no gateway goes straight through, for development', async () => {
    startPayment.mockResolvedValue({ status: 'unsupported' });

    await placeWithPayme();

    expect(cart.clearCart).toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
  });
});
