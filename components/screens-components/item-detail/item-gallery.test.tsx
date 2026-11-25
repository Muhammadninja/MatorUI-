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
vi.mock('lucide-react-native', () => ({ Camera: host('camera') }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
}));
vi.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: 390 }) },
  ScrollView: host('scroll'),
}));
vi.mock('@/components/screens-components/home/image-box', () => ({ default: host('image-box') }));
vi.mock('@/components/shared/product-image-placeholder', () => ({ default: host('placeholder') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: { white: '#fff', backgroundSecondary: '#eee' } }),
}));
vi.mock('@/contexts/active-vehicle.context', () => ({
  useActiveVehicle: () => ({
    currentActiveVehicle: { vehicle: { year: 2022, make: 'Chevrolet', model: 'Cobalt' } },
  }),
}));

import ItemGallery from './item-gallery';

const props = {
  images: [],
  title: 'Front brake pad',
  height: 340,
  index: 0,
  onIndexChange: () => {},
  onPressImage: () => {},
  categoryId: 'cat_brake_pads',
  productId: 'part-72',
  manufacturer: 'Bosch',
  partNumber: 'BP-0081',
  oemNumbers: ['96535062', '96535063'],
};

test('uses a compact no-photo block with planned and on-request photography copy', async () => {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<ItemGallery {...props} photoPlanned />);
  });
  const root = tree.root.find(
    (node) =>
      String(node.type) === 'view' && (node.props.style as { height?: number })?.height === 254,
  );
  expect(root).toBeTruthy();
  expect(tree.root.findAll((node) => String(node.type) === 'button')).toHaveLength(0);
  expect(tree.root.findAll((node) => String(node.type) === 'placeholder')[0]?.props.width).toBe(
    '100%',
  );
  expect(
    tree.root.findAll((node) => String(node.type) === 'placeholder')[0]?.props.photoCaption,
  ).toBe('itemDetail.photoPlannedDetail');
  await act(async () => {
    tree.update(<ItemGallery {...props} photoPlanned={false} />);
  });
  expect(
    tree.root.findAll((node) => String(node.type) === 'placeholder')[0]?.props.photoCaption,
  ).toBe('catalog.photoOnRequest');
});

test('prepares a confirmed, editable photo request with MPN separate from OEM references', async () => {
  push.mockClear();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<ItemGallery {...props} />);
  });
  const action = tree.root.find(
    (node) =>
      String(node.type) === 'pressable' &&
      node.props.accessibilityLabel === 'itemDetail.requestPhotoViaAI',
  );
  await act(async () => action.props.onPress());
  expect(push).toHaveBeenCalledTimes(1);
  const route = push.mock.calls[0]![0] as {
    params: { shoppingPrompt: string; shoppingSource: string };
  };
  expect(route.params.shoppingSource).toBe('product_photo_request');
  expect(route.params.shoppingPrompt).toContain('BP-0081');
  expect(route.params.shoppingPrompt).toContain('96535062, 96535063');
  expect(route.params.shoppingPrompt).toContain('2022 Chevrolet Cobalt');
});

test('switches to the no-photo state after every image URL fails', async () => {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<ItemGallery {...props} images={['https://broken-fixture.invalid/item.jpg']} />);
  });
  const image = tree.root.find((node) => String(node.type) === 'image-box');
  await act(async () => image.props.onPhotoError());

  expect(
    tree.root.findAll(
      (node) =>
        String(node.type) === 'view' && (node.props.style as { height?: number })?.height === 254,
    ),
  ).toHaveLength(1);
  expect(tree.root.findAll((node) => String(node.type) === 'placeholder')).toHaveLength(1);
  expect(
    tree.root.findAll(
      (node) =>
        String(node.type) === 'pressable' &&
        node.props.accessibilityLabel === 'itemDetail.requestPhotoViaAI',
    ),
  ).toHaveLength(1);
});

test('keeps the photo gallery when one of multiple image URLs fails', async () => {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <ItemGallery
        {...props}
        images={['https://broken-fixture.invalid/item.jpg', 'https://cdn.example/item-2.jpg']}
      />,
    );
  });
  const failedImage = tree.root.find(
    (node) =>
      String(node.type) === 'image-box' &&
      node.props.uri === 'https://broken-fixture.invalid/item.jpg',
  );
  await act(async () => failedImage.props.onPhotoError());

  expect(
    tree.root.findAll(
      (node) =>
        String(node.type) === 'view' && (node.props.style as { height?: number })?.height === 340,
    ),
  ).toHaveLength(1);
  expect(tree.root.findAll((node) => String(node.type) === 'placeholder')).toHaveLength(0);
});
