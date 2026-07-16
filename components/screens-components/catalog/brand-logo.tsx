import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

// All brand logos are SVGs in `assets/brands_svg/`, imported as components via
// react-native-svg-transformer (see svg.d.ts + metro.config.js).
import Byd from '../../../assets/brands_svg/byd.svg';
import Chery from '../../../assets/brands_svg/chery.svg';
import Chevrolet from '../../../assets/brands_svg/chevrolet.svg';
import Haval from '../../../assets/brands_svg/haval.svg';
import Hyundai from '../../../assets/brands_svg/hyundai.svg';
import Kia from '../../../assets/brands_svg/kia.svg';
import Skoda from '../../../assets/brands_svg/skoda.svg';
import Toyota from '../../../assets/brands_svg/toyota.svg';
import Volkswagen from '../../../assets/brands_svg/volkswagen.svg';

// Lowercase make id → SVG logo component.
const SVG_LOGOS: Record<string, FC<SvgProps>> = {
  byd: Byd,
  chery: Chery,
  chevrolet: Chevrolet,
  haval: Haval,
  hyundai: Hyundai,
  kia: Kia,
  skoda: Skoda,
  toyota: Toyota,
  volkswagen: Volkswagen,
};

function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase();
}

/** Whether a real brand-logo asset exists for this make name. */
export function hasBrandLogo(name: string): boolean {
  return normalizeBrandName(name) in SVG_LOGOS;
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
  /** Make name — matched case-insensitively against a key in `SVG_LOGOS`. */
  name: string;
  size?: number;
};

/**
 * `BrandLogo` — renders the vehicle make's real SVG brand logo (from
 * `assets/brands_svg/`) at the given size, in the brand's own colors. Used on
 * the Explore "Shop by vehicle" tiles and the Make screen hero. Renders nothing
 * for an unknown make.
 */
export default function BrandLogo({ name, size = 40 }: BrandLogoProps) {
  const SvgLogo = SVG_LOGOS[normalizeBrandName(name)];
  if (!SvgLogo) return null;
  return <SvgLogo width={size} height={size} color="currentColor" />;
}
