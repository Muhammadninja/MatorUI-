import { type ImageContentFit } from 'expo-image';
import { memo } from 'react';
import { type DimensionValue } from 'react-native';

import { AppImage } from '@/components/shared/app-image';
import ProductImagePlaceholder from '@/components/shared/product-image-placeholder';

export type ImageBoxProps = {
  /** Accessibility label (product/vehicle name). */
  label: string;
  /** Real image URL. When present the box renders the photo (cover) and
   *  falls back to the part placeholder if it fails to load. */
  uri?: string;
  height: DimensionValue;
  width?: DimensionValue;
  radius?: number;
  small?: boolean;
  /**
   * How the photo fills the box. Default 'cover' (fills + crops). Use
   * 'contain' for catalog parts whose photos vary wildly in shape/size — it
   * shows the WHOLE part (no cropping) and letterboxes onto `backgroundColor`.
   */
  contentFit?: ImageContentFit;
  /** Tile / letterbox color behind the photo. Product photos are shot on
   *  white, so pass white here with `contentFit='contain'` for a clean,
   *  fully-visible part in both light and dark mode. */
  backgroundColor?: string;
  /** Width in POINTS the box is drawn at, so the CDN can hand back a
   *  right-sized derivative. Only needed when `width` is a percentage. */
  targetWidth?: number;
  /** Stable backend category id for an intentional no-photo illustration. */
  categoryId?: string;
  manufacturer?: string;
  photoPlanned?: boolean;
  onPhotoLoad?: () => void;
  onPhotoError?: () => void;
};

/**
 * Product image box. Renders the real `uri` when present; otherwise shows the
 * neutral part placeholder, so a listing with no photo reads as "no photo"
 * rather than as a product that happens to look like the old stand-in PNG.
 */
function ImageBox({
  label,
  uri,
  height,
  width = '100%',
  radius = 0,
  contentFit = 'cover',
  backgroundColor,
  targetWidth,
  categoryId,
  manufacturer,
  photoPlanned = false,
  onPhotoLoad,
  onPhotoError,
}: ImageBoxProps) {
  const placeholder = (
    <ProductImagePlaceholder
      label={label}
      categoryId={categoryId}
      manufacturer={manufacturer}
      photoPlanned={photoPlanned}
      width={width}
      height={height}
      radius={radius}
    />
  );

  if (uri) {
    return (
      <AppImage
        source={uri}
        width={width}
        height={height}
        rounded={radius}
        alt={label}
        fallback={placeholder}
        onLoad={onPhotoLoad}
        onError={onPhotoError}
        contentFit={contentFit}
        placeholderColor={backgroundColor}
        targetWidth={targetWidth}
      />
    );
  }

  return placeholder;
}

export default memo(ImageBox);
