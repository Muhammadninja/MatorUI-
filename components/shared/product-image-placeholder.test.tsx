import React, { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

vi.mock('react-native', () => ({ View: 'view', Text: 'text', StyleSheet: { absoluteFill: {} } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-native-svg', () => ({
  default: 'svg',
  Circle: 'circle',
  Ellipse: 'ellipse',
  Line: 'line',
  Path: 'path',
  Rect: 'rect',
}));
vi.mock('expo-image', () => ({ Image: 'remote-image' }));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({
    tokens: {
      textMuted: '#667',
      backgroundSecondary: '#eee',
      productPlaceholderBackground: '#f1f5f4',
      productPlaceholderFill: '#dce6e3',
      productPlaceholderSide: '#c8d6d2',
      productPlaceholderHighlight: '#e8efed',
      productPlaceholderOutline: '#78918e',
      productPlaceholderManufacturer: '#245f5b',
    },
  }),
}));
vi.mock('@/components/shared/app-image/image-shimmer', () => ({ default: () => null }));

import ImageBox from '@/components/screens-components/home/image-box';
import { resolveProductImageShape } from './product-image-placeholder';

const CATEGORY_IDS = [
  'cat_oil_filters',
  'cat_air_filters',
  'cat_brake_pads',
  'cat_brake_discs',
  'cat_spark_plugs',
  'cat_shock_absorbers',
  'cat_suspension_arms',
  'cat_belts_tensioners',
  'cat_bearings_hubs',
  'cat_oils_fluids',
  'cat_batteries',
  'cat_radiators_cooling',
  'cat_sensors_electrical',
  'cat_engine_components',
  'cat_windshield_wipers',
];

async function render(uri: string | undefined, categoryId: string, width: number) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ImageBox label="Part" uri={uri} categoryId={categoryId} width={width} height={width} />,
    );
  });
  return tree;
}

describe('ProductImagePlaceholder through the shared ImageBox', () => {
  test('maps all 15 backend category ids and falls back for unknown ids', () => {
    CATEGORY_IDS.forEach((id, index) => expect(resolveProductImageShape(id)).toBe(index + 1));
    expect(resolveProductImageShape('translated-brakes-name')).toBe(0);
    expect(resolveProductImageShape()).toBe(0);
    expect(resolveProductImageShape('cat_shock_absorbers')).toBe(6);
    expect(resolveProductImageShape('cat_brake_pads')).toBe(3);
    expect(resolveProductImageShape('cat_oil_filters')).toBe(1);
  });

  test('shows maker attribution and the localized photo-on-request caption', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ImageBox
          label="Part"
          categoryId="cat_shock_absorbers"
          manufacturer="KYB"
          width={156}
          height={156}
        />,
      );
    });
    const labels = tree.root.findAllByType('text' as never).map((node) => node.props.children);
    expect(labels).toContain('KYB');
    expect(labels).toContain('catalog.photoOnRequest');
  });

  test('uses the warm coming-soon message only for explicitly planned photography', async () => {
    let planned!: ReactTestRenderer;
    let unplanned!: ReactTestRenderer;
    await act(async () => {
      planned = create(
        <ImageBox
          label="Planned photo"
          categoryId="cat_oil_filters"
          photoPlanned
          width={156}
          height={156}
        />,
      );
      unplanned = create(
        <ImageBox label="No photo plan" categoryId="cat_oil_filters" width={156} height={156} />,
      );
    });
    const plannedLabels = planned.root
      .findAllByType('text' as never)
      .map((node) => node.props.children);
    const unplannedLabels = unplanned.root
      .findAllByType('text' as never)
      .map((node) => node.props.children);
    expect(plannedLabels).toContain('catalog.photoComingSoon');
    expect(plannedLabels).not.toContain('catalog.photoOnRequest');
    expect(unplannedLabels).toContain('catalog.photoOnRequest');
    expect(unplannedLabels).not.toContain('catalog.photoComingSoon');
  });

  test.each([
    ['grid', 156],
    ['list', 104],
  ])('renders category illustration in %s dimensions', async (_layout, size) => {
    const tree = await render(undefined, 'cat_brake_pads', size);
    expect(tree.root.findAllByType('svg' as never)).toHaveLength(1);
    expect(tree.root.findAllByType('remote-image' as never)).toHaveLength(0);
    expect(tree.root.findAllByType('path' as never).length).toBeGreaterThan(0);
  });

  test('broken image switches once to the category fallback; a new valid URL replaces it', async () => {
    const tree = await render('https://broken-fixture.invalid/photo.jpg', 'cat_oil_filters', 120);
    const brokenImage = tree.root.findByType('remote-image' as never);
    await act(async () => brokenImage.props.onError());
    expect(tree.root.findAllByType('remote-image' as never)).toHaveLength(0);
    expect(tree.root.findAllByType('svg' as never)).toHaveLength(1);

    await act(async () => {
      tree.update(
        <ImageBox
          label="Part"
          uri="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=640&q=80"
          categoryId="cat_oil_filters"
          width={120}
          height={120}
        />,
      );
    });
    expect(tree.root.findAllByType('remote-image' as never)).toHaveLength(1);
    expect(tree.root.findAllByType('svg' as never)).toHaveLength(0);
  });

  test('unknown category uses a neutral outline instead of a broken-image glyph', async () => {
    const tree = await render(undefined, 'server-added-category', 100);
    expect(tree.root.findAllByType('circle' as never).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType('svg' as never)).toHaveLength(1);
  });
});
