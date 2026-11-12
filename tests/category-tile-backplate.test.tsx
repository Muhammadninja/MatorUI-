/** Category art stays directly on the tile surface in both color schemes. */
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
    tokens: { text: '#text', textMuted: '#muted', backgroundSecondary: '#bg2' },
  }),
}));

const { default: CategoryTile } =
  await import('@/components/screens-components/catalog/category-tile');
const { ROOT_META } = await import('@/services/categories-service');

function artFor(rootId: string, scheme: 'dark' | 'light') {
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
  return {
    backgroundColor: art.props.style.backgroundColor as string | undefined,
    imageSize: art.findByType('image').props.style.width as number,
  };
}

const ROOTS = [
  'brake-system',
  'electrical-and-lighting',
  'suspension-and-steering',
  'engine-system',
  'motor-oil',
  'tuning-and-accessories',
  'transmission',
  'maintenance-and-fluids',
  'heating-and-cooling',
];

describe('category tile art', () => {
  test.each(ROOTS)('dark mode: %s has no art backplate', (root) => {
    expect(artFor(root, 'dark').backgroundColor).toBeUndefined();
  });

  test.each(ROOTS)('light mode: %s has no art backplate', (root) => {
    expect(artFor(root, 'light').backgroundColor).toBeUndefined();
  });

  test.each(ROOTS)('dark mode: %s uses the same 64pt art box', (root) => {
    expect(artFor(root, 'dark').imageSize).toBe(64);
  });
});
