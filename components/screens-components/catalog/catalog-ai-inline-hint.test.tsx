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
vi.mock('expo-router', () => ({ router: { push }, useFocusEffect: () => {} }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'uz' } }),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({
    tokens: {
      text: '#111',
      textMuted: '#666',
      brandSoft: '#eee',
      brandBg: '#033',
      onBrand: '#fff',
    },
  }),
}));
vi.mock('@/contexts/active-vehicle.context', () => ({
  useActiveVehicle: () => ({
    currentActiveVehicle: { vehicle: { year: 2022, make: 'Chevrolet', model: 'Cobalt' } },
  }),
}));

import CatalogAIInlineHint from './catalog-ai-inline-hint';

test('opens once and hands category plus selected vehicle to the existing chat draft', async () => {
  push.mockClear();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<CatalogAIInlineHint categoryId="cat_brakes" categoryLabel="Brakes" />);
  });
  const button = tree.root.find((node) => String(node.type) === 'pressable');
  await act(async () => {
    button.props.onPress();
    button.props.onPress();
  });
  expect(push).toHaveBeenCalledTimes(1);
  const route = push.mock.calls[0]![0] as {
    params: { shoppingPrompt: string; shoppingSource: string };
  };
  expect(route.params.shoppingSource).toBe('category_inline');
  expect(route.params.shoppingPrompt).toContain('Brakes');
  expect(route.params.shoppingPrompt).not.toContain('cat_brakes');
  expect(route.params.shoppingPrompt).toContain('2022 Chevrolet Cobalt');
  expect(tree.root.find((node) => String(node.type) === 'pressable').props.disabled).toBe(true);
});
