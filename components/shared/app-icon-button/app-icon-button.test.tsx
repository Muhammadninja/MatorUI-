import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: { icon: '#111111' } }),
}));
vi.mock('@/components/shared/app-view', () => ({
  AppPressableView: ({ children, ...props }: any) => React.createElement('button', props, children),
}));
import { AppIconButton } from './app-icon-button';

async function iconProps(fill?: string) {
  const seen: Record<string, unknown>[] = [];
  const Icon = (props: Record<string, unknown>) => {
    seen.push(props);
    return null;
  };
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<AppIconButton Icon={Icon} fill={fill} accessibilityLabel="Added" />);
  });
  await act(async () => tree.unmount());
  return seen[0];
}

describe('AppIconButton', () => {
  // An explicit `fill: undefined` overrides lucide's `fill: "none"` and the
  // open Check path renders as a solid black wedge.
  test('leaves fill out when the caller sets none', async () => {
    expect(Object.hasOwn(await iconProps(), 'fill')).toBe(false);
  });

  test('forwards an explicit fill for toggled icons', async () => {
    expect((await iconProps('#ff0000')).fill).toBe('#ff0000');
  });
});
