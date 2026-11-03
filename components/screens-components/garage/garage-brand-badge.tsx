import BrandLogo from '@/components/screens-components/catalog/brand-logo';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useMakes } from '@/hooks/use-vehicle-catalog';

export type GarageBrandBadgeProps = {
  /** The vehicle's make, matched by name against the catalogue's makes. */
  make: string;
  size?: number;
};

/**
 * A make's logo on a small white rounded square — white in both themes, because
 * logos are drawn for a white ground. A make with no logo, or a catalogue that
 * hasn't loaded, gets `BrandLogo`'s initial instead of a blank chip. Decorative:
 * the name beside it is what a screen reader should read.
 */
export function GarageBrandBadge({ make, size = 48 }: GarageBrandBadgeProps) {
  const { tokens } = useThemeContext();
  const { makes } = useMakes();
  const makeName = make.toLowerCase();
  const match = makes.find((m) => m.name.toLowerCase() === makeName);

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
        size={Math.round(size * 0.75)}
        color={tokens.black}
      />
    </AppView>
  );
}

export default GarageBrandBadge;
