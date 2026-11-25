import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, test, vi } from 'vitest';

const { push, host } = vi.hoisted(() => ({
  push: vi.fn(),
  host:
    (type: string) =>
    ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, props, children),
}));
vi.mock('expo-router', () => ({ router: { push } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
}));
vi.mock('react-native-svg', () => ({
  default: 'svg',
  Circle: 'circle',
  Path: 'path',
  Rect: 'rect',
}));
vi.mock('lucide-react-native', () => ({ X: 'x' }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({
    tokens: {
      productPlaceholderBackground: '#f7faf9',
      productPlaceholderFill: '#d5e9e4',
      productPlaceholderHighlight: '#e8f3ef',
      productPlaceholderOutline: '#377d78',
      text: '#111',
      textMuted: '#666',
      brandText: '#245f5b',
    },
  }),
}));
vi.mock('@/contexts/active-vehicle.context', () => ({
  useActiveVehicle: () => ({
    currentActiveVehicle: { vehicle: { year: 2022, make: 'Chevrolet', model: 'Cobalt' } },
  }),
}));

import CatalogPhotoAnnouncement from './catalog-photo-announcement';

test('sends category and selected vehicle into the existing editable Mator AI draft', async () => {
  push.mockClear();
  const onDismiss = vi.fn();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <CatalogPhotoAnnouncement
        categoryId="cat_oil_filters"
        categoryLabel="Oil filters"
        onDismiss={onDismiss}
      />,
    );
  });
  const pressables = tree.root.findAll((node) => String(node.type) === 'pressable');
  const cta = pressables.find(
    (node) => node.props.accessibilityLabel === 'catalog.photoAnnouncementCta',
  );
  const dismiss = pressables.find((node) => node.props.accessibilityLabel === 'common.dismiss');
  expect(cta).toBeDefined();
  expect(dismiss).toBeDefined();

  await act(async () => {
    cta!.props.onPress();
    cta!.props.onPress();
    dismiss!.props.onPress();
  });
  expect(push).toHaveBeenCalledTimes(1);
  const route = push.mock.calls[0]![0] as {
    params: { shoppingPrompt: string; shoppingSource: string };
  };
  expect(route.params.shoppingSource).toBe('category_inline');
  expect(route.params.shoppingPrompt).toContain('Oil filters');
  expect(route.params.shoppingPrompt).not.toContain('cat_oil_filters');
  expect(route.params.shoppingPrompt).toContain('2022 Chevrolet Cobalt');
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
