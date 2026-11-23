/**
 * The return flow: a delivered order offers "Return conditions", which opens the
 * Refund & Returns Policy with the order's context and reaches support through
 * the channels the backend configures. No return request is created in the app.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, openURL, push, state } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  openURL: vi.fn(async (_url: string) => undefined),
  push: vi.fn(),
  state: {
    order: null as null | Record<string, unknown>,
    support: {
      loading: false,
      contacts: {
        phone: '+998502030318' as string | null,
        email: 'matorinnovations@gmail.com' as string | null,
        telegramUsername: 'Mator_AutoParts' as string | null,
      },
    },
  },
}));

vi.mock('react-native', () => ({ ScrollView: host('scroll'), Linking: { openURL }, Alert: { alert: vi.fn() } }));
vi.mock('expo-router', () => ({ useNavigation: () => ({ isFocused: () => true }), useSegments: () => [],
  router: { push, navigate: vi.fn() },
  useLocalSearchParams: () => ({ orderId: 'ord_1' }),
  useFocusEffect: vi.fn(),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('lucide-react-native', () => ({
  AlertCircle: () => null,
  Timer: () => null,
  Circle: () => null,
  CircleCheck: () => null,
  Clock: () => null,
  ShieldAlert: () => null,
  ChevronRight: () => null,
  FileText: () => null,
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-settings-header', () => ({ AppSettingsHeader: () => null }));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: host('loader') }));
vi.mock('@/components/screens-components/legal/legal-document-body', () => ({
  LegalDocumentBody: ({ doc }: { doc: { title: string } }) => React.createElement('policy', null, doc.title),
}));
vi.mock('@/components/screens-components/orders/order-price-breakdown', () => ({
  OrderLinePrice: () => null,
  OrderPriceBreakdown: () => null,
}));
vi.mock('@/components/screens-components/checkout/checkout-sections', () => ({ OrderChargeRows: () => null }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ danger: vi.fn(), success: vi.fn() }) }));
vi.mock('@/hooks/use-orders', () => ({
  // As the real hook: no id, no request and no order.
  useOrder: (id: string | null) =>
    id
      ? { state: state.order ? 'success' : 'not_found', order: state.order, refresh: vi.fn() }
      : { state: 'idle', order: null, refresh: vi.fn() },
}));
vi.mock('@/hooks/use-order-payment', () => ({
  useRecoverPayment: () => ({ paying: false, failure: null, pay: vi.fn() }),
}));
vi.mock('@/hooks/use-order-cancel-window', () => ({
  useOrderCancelWindow: () => ({ remainingMs: null, expired: false, canCancel: false, cancel: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock('@/hooks/use-legal', () => ({
  useLegalDocument: () => ({
    state: 'success',
    document: { title: 'Политика возврата и возмещения' },
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-support-contacts', () => ({ useSupportContacts: () => state.support }));

import ReturnPolicyScreen from '@/components/screens/return-policy-screen';
// Cancelling (and its parts going back to the cart) is covered in order-payment-screens.test.tsx.
vi.mock('@/hooks/use-cancel-order', () => ({ useCancelOrderToCart: () => ({ run: vi.fn(), isPending: false }) }));
// Where a pickup order is collected is covered in order-payment-screens.test.tsx.
vi.mock('@/components/screens-components/checkout/pickup-points', () => ({ PickupPoints: () => null }));
import TrackOrderScreen from '@/components/screens/track-order-screen';
import i18n from '@/services/i18n';
import { formatOrderNo } from '@/services/orders-service';

const ORDER_ID = 'ord_7f3a9c2e41b8';
const order = (over: Record<string, unknown> = {}) => ({
  id: ORDER_ID,
  status: 'delivered',
  statusLabel: 'Delivered',
  etaWindow: 'Delivered',
  placedAt: '',
  steps: [],
  currentStepIndex: 4,
  destination: { id: '', label: '', line1: '', city: '' },
  courier: null,
  items: [{ id: 'part_1', productId: 'part_1', title: 'Тормозные колодки', quantity: 1, price: '' }],
  totalLabel: '',
  serverStatus: 'delivered',
  deliveredAt: new Date(2026, 10, 12, 14, 5).toISOString(),
  ...over,
});

describe('return flow', () => {
  let renderer: ReactTestRenderer;
  const byTestId = (id: string) => renderer.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
  const allText = () =>
    renderer.root
      .findAll((n) => n.type === 'text')
      .flatMap((n) => n.children.filter((c): c is string => typeof c === 'string'))
      .join(' | ');
  const mount = async (screen: React.ReactElement) => {
    await act(async () => {
      renderer = create(screen);
    });
  };

  beforeAll(async () => {
    await i18n.changeLanguage('ru');
  });
  beforeEach(() => {
    vi.clearAllMocks();
    state.order = order();
    state.support = {
      loading: false,
      contacts: { phone: '+998502030318', email: 'matorinnovations@gmail.com', telegramUsername: 'Mator_AutoParts' },
    };
  });

  describe('order details', () => {
    test('a delivered order offers the return conditions', async () => {
      await mount(<TrackOrderScreen />);
      const [button] = byTestId('track-order-return-btn');
      expect(button.props.title).toBe('Условия возврата');
      await act(async () => button.props.onPress());
      expect(push).toHaveBeenCalledWith({ pathname: '/return-policy', params: { orderId: ORDER_ID } });
    });

    test.each(['pending_payment', 'paid', 'processing', 'shipped', 'cancelled', 'refunded'])(
      'a %s order does not',
      async (serverStatus) => {
        state.order = order({ serverStatus });
        await mount(<TrackOrderScreen />);
        expect(byTestId('track-order-return-btn')).toHaveLength(0);
      },
    );
  });

  describe('return conditions screen', () => {
    test('shows the order, its receipt date and the 10-day window', async () => {
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      const text = allText();
      expect(text).toContain(formatOrderNo(ORDER_ID));
      expect(byTestId('return-policy-received')).toHaveLength(1);
      expect(text).toContain('10 дней — для подходящих товаров надлежащего качества');
      expect(text).toContain('Дефектные товары — согласно гарантийным и законодательным срокам');
      // The policy text is not inlined: the screen links to it.
      expect(renderer.root.findAll((n) => (n.type as unknown) === 'policy')).toHaveLength(0);
    });

    test('the policy opens on its own screen, so Back returns to the return screen', async () => {
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      const link = byTestId('return-policy-document-link');
      expect(link).toHaveLength(1);
      expect(allText()).toContain('Политика возврата и возмещения');
      await act(async () => link[0].props.onPress());
      expect(push).toHaveBeenCalledWith('/refund-policy');
    });

    test('says plainly that no request is created in the app', async () => {
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      expect(allText()).toContain('Заявка в приложении не создаётся');
    });

    test('Telegram carries the order and product', async () => {
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      await act(async () => byTestId('return-policy-telegram')[0].props.onPress());
      const url = openURL.mock.calls[0][0] as string;
      expect(url.startsWith('https://t.me/Mator_AutoParts?text=')).toBe(true);
      const text = decodeURIComponent(url.split('?text=')[1]);
      expect(text).toContain(ORDER_ID);
      expect(text).toContain('Тормозные колодки');
      expect(text).toContain('part_1');
    });

    test('e-mail carries the same context', async () => {
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      await act(async () => byTestId('return-policy-email')[0].props.onPress());
      const mail = openURL.mock.calls[0][0] as string;
      expect(mail.startsWith('mailto:matorinnovations@gmail.com?subject=')).toBe(true);
      expect(decodeURIComponent(mail)).toContain(ORDER_ID);
    });

    test('never offers a call, even when the backend serves a phone', async () => {
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      expect(byTestId('return-policy-telegram')).toHaveLength(1);
      expect(byTestId('return-policy-email')).toHaveLength(1);
      expect(byTestId('return-policy-call')).toHaveLength(0);
      expect(allText()).not.toContain('+998502030318');
      expect(allText()).not.toContain('Позвонить');
    });

    test('with several products, the chosen one goes into the message', async () => {
      state.order = order({
        items: [
          { id: 'part_1', productId: 'part_1', title: 'Тормозные колодки', quantity: 1, price: '' },
          { id: 'part_2', productId: 'part_2', title: 'Масляный фильтр', quantity: 1, price: '' },
        ],
      });
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      await act(async () => byTestId('return-policy-item-1')[0].props.onPress());
      await act(async () => byTestId('return-policy-telegram')[0].props.onPress());
      const text = decodeURIComponent((openURL.mock.calls[0][0] as string).split('?text=')[1]);
      expect(text).toContain('Масляный фильтр');
      expect(text).not.toContain('Тормозные колодки');
    });

    test('only configured channels are offered', async () => {
      state.support = {
        loading: false,
        contacts: { phone: null, email: null, telegramUsername: 'Mator_AutoParts' },
      };
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      expect(byTestId('return-policy-telegram')).toHaveLength(1);
      expect(byTestId('return-policy-call')).toHaveLength(0);
      expect(byTestId('return-policy-email')).toHaveLength(0);
    });

    test('with no channel configured it says support is unavailable', async () => {
      state.support = {
        loading: false,
        contacts: { phone: null, email: null, telegramUsername: null },
      };
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      expect(byTestId('return-policy-support-unavailable')).toHaveLength(1);
    });

    test('a phone alone is not a channel: support reads as unavailable', async () => {
      state.support = {
        loading: false,
        contacts: { phone: '+998502030318', email: null, telegramUsername: null },
      };
      await mount(<ReturnPolicyScreen orderId={ORDER_ID} />);
      expect(byTestId('return-policy-support-unavailable')).toHaveLength(1);
      expect(byTestId('return-policy-call')).toHaveLength(0);
    });

    test('without an order (checkout, Settings) it shows the policy and support only', async () => {
      await mount(<ReturnPolicyScreen />);
      expect(byTestId('return-policy-order')).toHaveLength(0);
      await act(async () => byTestId('return-policy-telegram')[0].props.onPress());
      const text = decodeURIComponent((openURL.mock.calls[0][0] as string).split('?text=')[1]);
      expect(text).toBe('Здравствуйте! У меня вопрос о возврате товара.');
    });
  });
});
