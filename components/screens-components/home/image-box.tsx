import { memo } from 'react';
import { Image, type DimensionValue } from 'react-native';

import { AppImage } from '@/components/shared/app-image';

// Stand-in product photo used while the catalog ships no real image URLs.
const TEST_IMAGE = require('@/assets/images/test-image.png');

export type ImageBoxProps = {
  /** Accessibility label (product/vehicle name). */
  label: string;
  /** Real image URL. When present the box renders the photo (cover) and
   *  falls back to the test image if it fails to load. */
  uri?: string;
  height: DimensionValue;
  width?: DimensionValue;
  radius?: number;
  small?: boolean;
};

/**
 * Product image box. Renders the real `uri` when present; otherwise shows the
 * bundled test image so every product slot has a photo until the backend
 * ships imagery.
 */
function ImageBox({ label, uri, height, width = '100%', radius = 14 }: ImageBoxProps) {
  const testImage = (
    <Image source={TEST_IMAGE} style={{ width, height, borderRadius: radius }} resizeMode="cover" />
  );

  if (uri) {
    return (
      <AppImage
        source={uri}
        width={width}
        height={height}
        rounded={radius}
        alt={label}
        fallback={testImage}
      />
    );
  }

  return testImage;
}

export default memo(ImageBox);
