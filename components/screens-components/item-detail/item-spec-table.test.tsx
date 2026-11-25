import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, test, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('lucide-react-native', () => ({
  Copy: (props: Record<string, unknown>) => React.createElement('copy-icon', props),
}));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({
    tokens: { text: '#111', textMuted: '#666', divider: '#ddd', brandText: '#377D78' },
  }),
}));
vi.mock('@/components/shared/app-text', () => ({
  AppText: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('text', props, children),
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('view', props, children),
  AppPressableView: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('pressable', props, children),
}));

import { ItemSpecTable } from './item-info';

test('gives copyable identifiers the full value column beside a separate copy action', async () => {
  const onCopy = vi.fn();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <ItemSpecTable
        specs={[
          {
            label: 'Manufacturer part number',
            value: 'MPN-BOS-00000000-REFERENCE-LONG',
            copyable: true,
          },
        ]}
        onCopy={onCopy}
      />,
    );
  });

  const row = tree.root.find(
    (node) =>
      String(node.type) === 'view' &&
      !node.props.row &&
      (node.props.style as { borderBottomWidth?: number } | undefined)?.borderBottomWidth != null,
  );
  const value = tree.root.find(
    (node) =>
      String(node.type) === 'text' && node.props.children === 'MPN-BOS-00000000-REFERENCE-LONG',
  );
  const copyAction = tree.root.find(
    (node) =>
      String(node.type) === 'pressable' &&
      node.props.accessibilityLabel === 'itemDetail.copyIdentifier',
  );

  expect(row.props.gap).toBe(5);
  expect(value.props.style).toMatchObject({ flex: 1, flexShrink: 1 });
  await act(async () => copyAction.props.onPress());
  expect(onCopy).toHaveBeenCalledWith('MPN-BOS-00000000-REFERENCE-LONG');
});
