import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('lucide-react-native', () => ({ AlertCircle: () => null, Heart: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/screens-components/catalog/product-row', () => ({
  default: () => null,
  productCellStyle: () => ({}),
  useProductGridColumns: () => 2,
}));
vi.mock('@/components/shared/app-list', () => ({ default: () => null }));
vi.mock('@/components/shared/app-settings-header', () => ({ AppSettingsHeader: () => null }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: (props: any) => <button {...props}>{props.title}</button> }));
vi.mock('@/components/shared/app-text', () => ({ AppText: ({ children }: any) => <span>{children}</span> }));
vi.mock('@/components/shared/app-view', () => ({ AppView: ({ children, ...props }: any) => <section {...props}>{children}</section> }));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: () => null }));
vi.mock('@/contexts/cart.context', () => ({ useCartContext: () => ({ addItem: vi.fn() }) }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: { brandSoft: '', error: '' } }) }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ isAuthenticated: true }) }));
vi.mock('@/hooks/use-liked-products', () => ({
  useLikedProducts: () => ({ state: 'error', items: [], refresh: state.refresh }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('@/utils/nav', () => ({ openItemDetail: vi.fn() }));

import LikedScreen from '@/components/screens/liked-screen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => state.refresh.mockReset());

test('shows a localized retry state when saved parts fail to load', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<LikedScreen />); });
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).toContain('liked.loadErrorTitle');
  expect(rendered).toContain('liked.loadErrorBody');
  expect(rendered).not.toContain('liked.emptyTitle');
  await act(async () => { tree.root.findByProps({ title: 'common.retry' }).props.onPress(); });
  expect(state.refresh).toHaveBeenCalledOnce();
  await act(async () => tree.unmount());
});
