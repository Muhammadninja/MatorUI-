/**
 * Dark category art gets a quiet neutral plate on the dark card, and nothing
 * else changes: light mode, and the silver / red / grey art, draw as before.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, theme } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  theme: { scheme: 'dark' as 'dark' | 'light' },
}));

vi.mock('react-native', () => ({ Image: host('image') }));
vi.mock('lucide-react-native', () => ({ LayoutGrid: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({
    scheme: theme.scheme,
    tokens: { gray300: '#34404A', text: '#text', textMuted: '#muted', backgroundSecondary: '#bg2' },
  }),
}));

const { default: CategoryTile } =
  await import('@/components/screens-components/catalog/category-tile');
const { ROOT_META } = await import('@/services/categories-service');

function plateFor(rootId: string, scheme: 'dark' | 'light') {
  theme.scheme = scheme;
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <CategoryTile
        name={rootId}
        label={rootId}
        iconKey={ROOT_META[rootId].iconKey}
        onPress={() => {}}
      />,
    );
  });
  const art = tree.root.find(
    (n) => n.props.testID === 'category-tile-art' && String(n.type) === 'view',
  );
  return art.props.style.backgroundColor as string | undefined;
}

const DARK = ['electrical-and-lighting', 'suspension-and-steering', 'engine-system'];
const READS_ALONE = [
  'brake-system',
  'motor-oil',
  'tuning-and-accessories',
  'transmission',
  'maintenance-and-fluids',
  'heating-and-cooling',
];

describe('category tile backplate', () => {
  test.each(DARK)('dark mode: %s sits on the gray300 plate', (root) => {
    expect(plateFor(root, 'dark')).toBe('#34404A');
  });

  test.each(READS_ALONE)('dark mode: %s needs none', (root) => {
    expect(plateFor(root, 'dark')).toBeUndefined();
  });

  test.each([...DARK, ...READS_ALONE])('light mode: %s has no plate', (root) => {
    expect(plateFor(root, 'light')).toBeUndefined();
  });
});
