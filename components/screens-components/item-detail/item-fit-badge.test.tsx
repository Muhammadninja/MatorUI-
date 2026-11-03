import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';
import type { CompatibilityResult } from '@/services/compatibility-service';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const locale = vi.hoisted(() => ({ language: 'ru' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const strings = locale.language === 'uz' ? uz : ru;
      return key.split('.').reduce((value: any, part) => value[part], strings);
    },
  }),
}));
vi.mock('lucide-react-native', () => ({
  Check: () => null,
  CircleAlert: () => null,
  X: () => null,
}));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: { success: '#0f9d58', error: '#db4437', warning: '#f4b400' } }),
}));
vi.mock('@/components/shared/app-text', () => ({
  AppText: ({ children }: any) => React.createElement('text', null, children),
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: ({ children }: any) => React.createElement('view', null, children),
  AppPressableView: ({ children, ...props }: any) => React.createElement('button', props, children),
}));
vi.mock('@/components/shared/app-button', () => ({
  AppButton: ({ title, ...props }: any) => React.createElement('button', props, title),
}));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: () => null }));
import { ItemFitBadge, ItemVehicleCta } from './item-fit-badge';

async function render(node: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(node);
  });
  const text = JSON.stringify(tree.toJSON());
  await act(async () => tree.unmount());
  return text;
}
describe.each(['ru', 'uz'])('compatibility presentation in %s', (language) => {
  test.each(['EXACT_MATCH', 'NOT_COMPATIBLE', 'UNCERTAIN'] as const)(
    '%s localizes status without translating the vehicle',
    async (status) => {
      locale.language = language;
      const keys = {
        EXACT_MATCH: 'fitConfirmed',
        NOT_COMPATIBLE: 'fitNotCompatible',
        UNCERTAIN: 'fitUnknown',
      } as const;
      const result: CompatibilityResult = {
        partId: 'part',
        vehicleId: 'vehicle',
        status,
        isCompatible: status === 'EXACT_MATCH',
        badge: { text: 'BACKEND RUSSIAN LABEL', color: 'green' },
        details: { matchedBy: 'MODEL_REF', oemNumber: '96471275' },
      };
      const text = await render(
        <ItemFitBadge result={result} subtitle="Chevrolet Nexia 3" onShowAlternatives={() => {}} />,
      );
      expect(text).toContain((language === 'uz' ? uz : ru).itemDetail[keys[status]]);
      expect(text).toContain('Chevrolet Nexia 3');
      expect(text).not.toContain('BACKEND RUSSIAN LABEL');
    },
  );
  test('missing verdict is explicit, while no vehicle still offers vehicle selection', async () => {
    locale.language = language;
    const strings = language === 'uz' ? uz : ru;
    expect(
      await render(
        <ItemVehicleCta checking={false} vehicleLabel="Chevrolet Nexia 3" onPress={() => {}} />,
      ),
    ).toContain(strings.itemDetail.fitUnknown);
    expect(
      await render(<ItemVehicleCta checking={false} vehicleLabel={null} onPress={() => {}} />),
    ).toContain(strings.itemDetail.confirmFitTitle);
  });
});
