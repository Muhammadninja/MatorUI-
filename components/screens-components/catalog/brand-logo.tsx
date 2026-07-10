import type { FC } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import Hyundai from '@/assets/brands/hyundai.svg';
import Kia from '@/assets/brands/kia.svg';
import Skoda from '@/assets/brands/skoda.svg';
import Toyota from '@/assets/brands/toyota.svg';
import Volkswagen from '@/assets/brands/volkswagen.svg';

// SVG logos import as components (react-native-svg-transformer).
const SVG_LOGOS: Record<string, FC<SvgProps>> = {
  Hyundai,
  Kia,
  Skoda,
  Toyota,
  Volkswagen,
};

// Raster (PNG) logos load as image sources.
const IMAGE_LOGOS: Record<string, ImageSourcePropType> = {
  Chevrolet: require('@/assets/brands/chevy.png'),
  BYD: require('@/assets/brands/BYD-Logo-Chinese-Electric-Vehicle-Brand.png'),
  Chery: require('@/assets/brands/chery.png'),
  Haval: require('@/assets/brands/haval.png'),
};

/** Whether a real brand-logo asset exists for this make name. */
export function hasBrandLogo(name: string): boolean {
  return name in SVG_LOGOS || name in IMAGE_LOGOS;
}

/** Every make we ship a real logo for — drives Explore's "Shop by vehicle"
 *  row. `id` is the lowercase key used for navigation / model lookup. */
export const LOGO_BRANDS: { id: string; label: string }[] = [
  { id: 'chevrolet', label: 'Chevrolet' },
  { id: 'byd', label: 'BYD' },
  { id: 'kia', label: 'Kia' },
  { id: 'chery', label: 'Chery' },
  { id: 'hyundai', label: 'Hyundai' },
  { id: 'haval', label: 'Haval' },
  { id: 'toyota', label: 'Toyota' },
  { id: 'skoda', label: 'Skoda' },
  { id: 'volkswagen', label: 'Volkswagen' },
];

export type BrandLogoProps = {
  /** Make name — must match a key in `SVG_LOGOS` / `IMAGE_LOGOS`. */
  name: string;
  size?: number;
};

/**
 * `BrandLogo` — renders the vehicle make's real brand logo (SVG or PNG from
 * `assets/brands/`) at the given size, in the brand's own colors. Used on the
 * Explore "Shop by vehicle" tiles and the Make screen hero. Renders nothing
 * for an unknown make.
 */
export default function BrandLogo({ name, size = 40 }: BrandLogoProps) {
  const SvgLogo = SVG_LOGOS[name];
  if (SvgLogo) return <SvgLogo width={size} height={size} />;

  const imageLogo = IMAGE_LOGOS[name];
  if (imageLogo) {
    return <Image source={imageLogo} style={{ width: size, height: size }} resizeMode="contain" />;
  }

  return null;
}
