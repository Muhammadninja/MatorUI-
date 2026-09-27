import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useLanguageContext } from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';
import { formatMileage } from '@/utils/mileage';


export type GarageActiveHeroProps = {
  vehicle: Vehicle;
  /** Primary CTA — "Shop parts that fit". */
  onShopParts: (id: string) => void;
  /** Square tune button — opens the vehicle detail screen. */
  onOpenDetail: (id: string) => void;
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function GarageActiveHero({ vehicle, onShopParts, onOpenDetail }: GarageActiveHeroProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { language } = useLanguageContext();

  // One muted line instead of the old labelled MILEAGE · VIN · TRIM stat grid.
  // That grid was six pieces of text for three facts, and two of them (VIN,
  // trim) are reference data nobody reads while choosing what to shop for —
  // they live on the vehicle-detail screen, one tap away. Mileage stays because
  // it is the one value that changes and that fitment leans on.
  const meta = [
    vehicle.trim,
    vehicle.color ? titleCase(vehicle.color) : undefined,
    formatMileage(vehicle.mileage, t('garage.mileageUnit'), language) || undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  // Every colour comes from the `hero*` theme tokens: an inverted black card
  // in light mode, the elevated card surface in dark mode. (It used the
  // `brand` CTA fill — white in dark mode — plus per-scheme rgba literals.)
  return (
    <AppView
      rounded={22}
      colorName="hero"
      p={18}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Active marker: the green dot alone. The uppercase "ACTIVE VEHICLE"
       *  label that sat beside it read as stiff and official, and the card is
       *  already the only one of its kind on the screen, so the word was doing
       *  no work the colour wasn't. The text moves to the a11y layer, where a
       *  screen reader still announces which car is active. */}
      <AppView
        accessible
        accessibilityLabel={t('garage.activeVehicle')}
        style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: tokens.success }}
      />

      {/* Title — year + make on one line, model on the next; both wrap
       *  rather than clip, so long makes ("Mercedes-Benz") stay readable. */}
      <AppView style={{ maxWidth: 210, marginTop: 10 }}>
        <AppText family="heading" weight="bold" style={{ fontSize: 26, lineHeight: 30, color: tokens.onHero }}>
          {`${vehicle.year} ${vehicle.make}`}
        </AppText>
        <AppText family="heading" weight="bold" style={{ fontSize: 26, lineHeight: 30, color: tokens.onHero }}>
          {vehicle.model}
        </AppText>
      </AppView>

      {meta ? (
        <AppText family="default" style={{ fontSize: 13, color: tokens.heroMuted, marginTop: 6 }}>
          {meta}
        </AppText>
      ) : null}

      {/* Actions — primary + square tune button. The CTA is the design
       *  system's `primary` pair (white fill, black label in both themes), so
       *  it reads on the black light-mode hero AND on the dark card surface;
       *  `background` would vanish into the dark hero. */}
      <AppView row gap={10} style={{ marginTop: 18 }}>
        <AppPressableView
          flex={1}
          center
          rounded={13}
          colorName="primaryBg"
          androidRipple
          onPress={() => onShopParts(vehicle.id)}
          accessibilityRole="button"
          accessibilityLabel={t('garage.shopPartsThatFit')}
          style={{ paddingVertical: 13, paddingHorizontal: 16 }}
        >
          <AppText family="accent" weight="bold" colorName="onPrimary" style={{ fontSize: 14 }}>
            {t('garage.shopPartsThatFit')}
          </AppText>
        </AppPressableView>

        <AppPressableView
          center
          rounded={13}
          onPress={() => onOpenDetail(vehicle.id)}
          accessibilityRole="button"
          accessibilityLabel={t('garage.vehicleDetails')}
          style={{ width: 46, backgroundColor: tokens.heroWash }}
        >
          <SlidersHorizontal size={20} strokeWidth={2.2} color={tokens.onHero} />
        </AppPressableView>
      </AppView>
    </AppView>
  );
}

export default GarageActiveHero;
