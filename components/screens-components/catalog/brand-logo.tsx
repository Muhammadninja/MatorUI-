import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { bundledBrandLogo } from '@/components/screens-components/catalog/bundled-brand-logos';

/**
 * `BrandLogo` — renders a vehicle make's logo from the backend
 * (`VehicleMake.logoUrl`, exposed as `RefMake.logoUrl`). Brands and their logos
 * are managed in the admin console. A make without one yet uses the logo the
 * app ships for it (`bundled-brand-logos.ts`), so a newly enabled brand is
 * never a bare letter.
 *
 * Falls back to the brand's initial (in the brand color) when there's neither
 * a usable `logoUrl` nor a bundled logo — e.g. an operator hasn't
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
  /** Optional tint used only when a monochrome logo needs contrast in dark UI. */
  tintColor?: string;
  /** Shown instead of the initial when there is no usable logo. */
  fallback?: ReactNode;
};

const BrandLogo = ({ logoUrl, name, size = 40, color, fallback, tintColor }: BrandLogoProps) => {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[{ width: size, height: size }, tintColor ? { tintColor } : undefined]}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={120}
        onError={() => setFailed(true)}
        accessibilityLabel={t('make.brandLogo', { name })}
      />
    );
  }

  const bundled = bundledBrandLogo(name);
  if (bundled !== null) {
    return (
      <Image
        source={bundled}
        style={[{ width: size, height: size }, tintColor ? { tintColor } : undefined]}
        contentFit="contain"
        accessibilityLabel={t('make.brandLogo', { name })}
      />
    );
  }

  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <AppText family="heading" weight="bold" style={{ fontSize: size * 0.55, color }}>
      {name.charAt(0).toUpperCase()}
    </AppText>
  );
};

export default BrandLogo;
