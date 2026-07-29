import { useState } from 'react';
import { Image } from 'react-native';

import { AppText } from '@/components/shared/app-text';

/**
 * `BrandLogo` — renders a vehicle make's logo from the backend
 * (`VehicleMake.logoUrl`, exposed as `RefMake.logoUrl`). Brands and their logos
 * are managed in the admin console; nothing is bundled in the app anymore.
 *
 * Falls back to the brand's initial (in the brand color) when there's no
 * `logoUrl` yet, or if the remote image fails to load — e.g. an operator hasn't
 * uploaded a logo, or supplied a URL React Native's <Image> can't render (it
 * handles PNG/JPG/WebP, not remote SVG). This keeps the tile from ever being a
 * blank chip.
 */
export type BrandLogoProps = {
  /** Remote logo URL from the backend; null → initial fallback. */
  logoUrl?: string | null;
  /** Brand display name — used for the initial fallback + accessibility. */
  name: string;
  size?: number;
  /** Color for the initial fallback. */
  color?: string;
};

export default function BrandLogo({ logoUrl, name, size = 40, color }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={() => setFailed(true)}
        accessibilityLabel={`${name} logo`}
      />
    );
  }

  return (
    <AppText family="heading" weight="bold" style={{ fontSize: size * 0.55, color }}>
      {name.charAt(0).toUpperCase()}
    </AppText>
  );
}
