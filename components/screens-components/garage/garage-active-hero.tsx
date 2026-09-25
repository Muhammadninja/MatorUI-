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

/** VIN masked to its last 6 chars for the stat row (full VIN lives on detail). */
function maskVin(vin: string | undefined): string {
  if (!vin) return '—';
  return vin.length > 6 ? `…${vin.slice(-6)}` : vin;
}

function Stat({
  label,
  value,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <AppView flex={1} style={{ minWidth: 0 }}>
      <AppText
        family="accent"
        weight="bold"
        transform="uppercase"
        numberOfLines={1}
        style={{ fontSize: 9.5, letterSpacing: 1.2, color: labelColor }}
      >
        {label}
      </AppText>
      <AppText
        family="default"
        weight="semibold"
        numberOfLines={1}
        style={{ fontSize: 13.5, color: valueColor, marginTop: 3 }}
      >
        {value || '—'}
      </AppText>
    </AppView>
  );
}

export function GarageActiveHero({ vehicle, onShopParts, onOpenDetail }: GarageActiveHeroProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { language } = useLanguageContext();

  const subline = [vehicle.trim, vehicle.color ? titleCase(vehicle.color) : undefined]
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

      {/* Title — two lines, clipped from the watermark. */}
      <AppView style={{ maxWidth: 210, marginTop: 10 }}>
        <AppText family="heading" weight="bold" numberOfLines={1} style={{ fontSize: 26, lineHeight: 30, color: tokens.onHero }}>
          {`${vehicle.year} ${vehicle.make}`}
        </AppText>
        <AppText family="heading" weight="bold" numberOfLines={1} style={{ fontSize: 26, lineHeight: 30, color: tokens.onHero }}>
          {vehicle.model}
        </AppText>
      </AppView>

      {subline ? (
        <AppText family="default" numberOfLines={1} style={{ fontSize: 13, color: tokens.onHero, opacity: 0.7, marginTop: 6 }}>
          {subline}
        </AppText>
      ) : null}

      {/* Stat row over a hairline */}
      <AppView row gap={14} style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: tokens.heroDivider }}>
        <Stat label={t('garage.statMileage')} value={formatMileage(vehicle.mileage, t('garage.mileageUnit'), language)} labelColor={tokens.heroMuted} valueColor={tokens.onHero} />
        <Stat label={t('garage.statVin')} value={maskVin(vehicle.vin)} labelColor={tokens.heroMuted} valueColor={tokens.onHero} />
        <Stat label={t('garage.statTrim')} value={vehicle.trim ?? '—'} labelColor={tokens.heroMuted} valueColor={tokens.onHero} />
      </AppView>

      {/* Actions — primary + square tune button. The CTA is the design
       *  system's `primary` pair (white fill, black label in both themes), so
       *  it reads on the black light-mode hero AND on the dark card surface;
       *  `background` would vanish into the dark hero. */}
      <AppView row gap={10} style={{ marginTop: 16 }}>
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
