import BrandLogo from '@/components/screens-components/catalog/brand-logo';
import { AppView } from '@/components/shared/app-view';
import { CarIcon } from '@/components/shared/mator-icons';
import { useThemeContext } from '@/contexts/theme.context';
import { useMakes } from '@/hooks/use-vehicle-catalog';
import { plainMakeId } from '@/services/vehicle-images/catalog-id';

export type GarageBrandBadgeProps = {
  /** The vehicle's manufacturer id (`make.id` from the backend). */
  makeId?: string;
  /** The vehicle's make name: matched only for older rows without an id. */
  make: string;
  size?: number;
};

/**
 * A make's logo (the same backend logos as Explore's "shop by make" row) on a
 * small white rounded square — white in both themes, because logos are drawn
 * for a white ground. Resolved by manufacturer id, never by a name's first
 * letter; a make with no logo, or a catalogue that hasn't loaded, gets a
 * neutral car instead of an initial. Decorative: the name beside it is what a
 * screen reader should read.
 */
export function GarageBrandBadge({ makeId, make, size = 48 }: GarageBrandBadgeProps) {
  const { tokens } = useThemeContext();
  const { makes } = useMakes();
  const makeName = make.toLowerCase();
  const match = makeId
    ? makes.find((m) => m.id === plainMakeId(makeId))
    : makes.find((m) => m.name.toLowerCase() === makeName);
  const logoSize = Math.round(size * 0.85);

  return (
    <AppView
      center
      rounded={12}
      borderWidth={1}
      borderName="border"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, flexShrink: 0, backgroundColor: tokens.white }}
    >
      <BrandLogo
        logoUrl={match?.logoUrl}
        name={make}
        size={logoSize}
        fallback={<CarIcon size={logoSize} color={tokens.onPhotoMuted} />}
      />
    </AppView>
  );
}

export default GarageBrandBadge;
