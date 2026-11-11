/**
 * "Адреса доставки" header (physical iPhone report: the title read small and
 * off-center between the back button and a wide "+ Добавить" pill).
 *
 *   - the shared settings header titles screens at 17pt, not a 14pt caption;
 *   - the addresses add action is a round button the size of the back button,
 *     so the title sits on the center line, and it keeps its spoken label;
 *   - with no addresses the empty state names the action in words.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));

vi.mock('expo-router', () => ({ router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() } }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
vi.mock('react-native', () => ({ ScrollView: host('rn-scroll') }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({
    scheme: 'light',
    tokens: new Proxy({}, { get: (_t, k) => `#${String(k)}` }),
  }),
}));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('lucide-react-native', () => ({
  AlertCircle: host('icon-alert'),
  ArrowLeft: host('icon-back'),
  MapPin: host('icon-pin'),
  Plus: host('icon-plus'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('app-text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('app-view'),
  AppPressableView: host('app-pressable'),
}));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('app-button') }));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: host('loader') }));
vi.mock('@/components/screens-components/account/address-form-sheet', () => ({
  default: host('address-form'),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ success: vi.fn(), danger: vi.fn() }) }));
vi.mock('@/services/debug-log', () => ({ debugLog: () => {} }));

let addresses: unknown[] = [];
const mutation = { mutateAsync: vi.fn() };
vi.mock('@/hooks/use-orders', () => ({
  useAddresses: () => ({ state: 'ready', items: addresses, refresh: vi.fn() }),
  useCreateAddress: () => mutation,
  useUpdateAddress: () => mutation,
  useRemoveAddress: () => mutation,
  useSetDefaultAddress: () => mutation,
}));

const { AppSettingsHeader, HEADER_ACTION_SIZE, HEADER_TITLE_SIZE } = await import(
  '@/components/shared/app-settings-header'
);
const { default: ShippingAddressesScreen } = await import(
  '@/components/screens/shipping-addresses-screen'
);

type Node = ReturnType<typeof create>['root'];
const flat = (style: unknown) =>
  Object.assign({}, ...([style].flat(Infinity) as object[]).filter(Boolean));

function render(el: React.ReactElement) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(el);
  });
  return tree;
}

function byTestID(root: Node, id: string) {
  return root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
}

beforeEach(() => {
  addresses = [];
});

describe('settings header title', () => {
  test('titles the screen at 17pt and lets it wrap instead of shrinking', () => {
    const tree = render(<AppSettingsHeader title="Адреса доставки" />);
    const title = tree.root.find(
      (n) => String(n.type) === 'app-text' && n.props.children === 'Адреса доставки',
    );
    expect(HEADER_TITLE_SIZE).toBe(17);
    expect(flat(title.props.style).fontSize).toBe(17);
    expect(title.props.textVariant).toBeUndefined();
    expect(title.props.adjustsFontSizeToFit).toBeUndefined();
    expect(title.props.numberOfLines).toBeUndefined();
  });

  test('the back button and the right slot are the same width', () => {
    const tree = render(<AppSettingsHeader title="x" right={null} />);
    const back = tree.root.find(
      (n) => String(n.type) === 'app-pressable' && n.props.accessibilityLabel === 'common.back',
    );
    expect(flat(back.props.style).width).toBe(HEADER_ACTION_SIZE);
    const slot = tree.root.find(
      (n) => String(n.type) === 'app-view' && flat(n.props.style).minWidth === HEADER_ACTION_SIZE,
    );
    expect(slot).toBeTruthy();
  });
});

describe('addresses screen header action', () => {
  test('is a round button the size of the back button, with a spoken label', () => {
    addresses = [{ id: 'a1', label: 'Дом', line1: 'Amir Temur 12', isDefault: true }];
    const tree = render(<ShippingAddressesScreen />);
    const header = tree.root.findByType(AppSettingsHeader);
    const add = render(header.props.right as React.ReactElement).root.find(
      (n) => n.props.testID === 'addresses-add' && typeof n.type !== 'string',
    );
    const style = flat(add.props.style);
    expect(style.width).toBe(HEADER_ACTION_SIZE);
    expect(style.height).toBe(HEADER_ACTION_SIZE);
    expect(add.props.accessibilityRole).toBe('button');
    expect(add.props.accessibilityLabel).toBe('addresses.addNew');
    // No text pill competing with the title for width.
    expect(add.findAll((n) => String(n.type) === 'app-text')).toHaveLength(0);
    // A saved list doesn't repeat the action in the body.
    expect(byTestID(tree.root, 'addresses-empty-add')).toHaveLength(0);
  });

  test('both add entry points open the add form', () => {
    const tree = render(<ShippingAddressesScreen />);
    const form = () => tree.root.find((n) => String(n.type) === 'address-form');
    expect(form().props.visible).toBe(false);

    const [emptyAdd] = byTestID(tree.root, 'addresses-empty-add');
    expect(emptyAdd.props.title).toBe('addresses.addNew');
    act(() => emptyAdd.props.onPress());
    expect(form().props.visible).toBe(true);
    expect(form().props.initial).toBeNull();

    act(() => form().props.onClose());
    const header = tree.root.findByType(AppSettingsHeader);
    act(() => (header.props.right as React.ReactElement<{ onPress: () => void }>).props.onPress());
    expect(form().props.visible).toBe(true);
  });
});
