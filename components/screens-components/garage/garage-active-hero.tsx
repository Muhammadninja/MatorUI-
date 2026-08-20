import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Vehicle } from '@/services/garage-service';


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

function formatMileage(km: number | undefined, unit: string): string {
  if (km === undefined || km === null) return '';
  return `${km.toLocaleString('en-US')} ${unit}`;
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
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  const hairline = isDark ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.18)';
  const statLabel = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)';
  const tuneWash = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.16)';

  const subline = [vehicle.trim, vehicle.color ? titleCase(vehicle.color) : undefined]
    .filter(Boolean)
    .join(' · ');

  return (
    <AppView
      rounded={22}
      colorName="brand"
      p={18}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Status line */}
      <AppView row align="center" gap={8}>
        <AppView style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: tokens.success }} />
        <AppText
          family="accent"
          weight="bold"
          transform="uppercase"
          style={{ fontSize: 10, letterSpacing: 1.6, color: tokens.onBrand, opacity: 0.75 }}
        >
          {t('garage.activeVehicle')}
        </AppText>
      </AppView>

      {/* Title — two lines, clipped from the watermark. */}
      <AppView style={{ maxWidth: 210, marginTop: 10 }}>
        <AppText family="heading" weight="bold" numberOfLines={1} style={{ fontSize: 26, lineHeight: 30, color: tokens.onBrand }}>
          {`${vehicle.year} ${vehicle.make}`}
        </AppText>
        <AppText family="heading" weight="bold" numberOfLines={1} style={{ fontSize: 26, lineHeight: 30, color: tokens.onBrand }}>
          {vehicle.model}
        </AppText>
      </AppView>

      {subline ? (
        <AppText family="default" numberOfLines={1} style={{ fontSize: 13, color: tokens.onBrand, opacity: 0.7, marginTop: 6 }}>
          {subline}
        </AppText>
      ) : null}

      {/* Stat row over a hairline */}
      <AppView row gap={14} style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: hairline }}>
        <Stat label={t('garage.statMileage')} value={formatMileage(vehicle.mileage, t('garage.mileageUnit'))} labelColor={statLabel} valueColor={tokens.onBrand} />
        <Stat label={t('garage.statVin')} value={maskVin(vehicle.vin)} labelColor={statLabel} valueColor={tokens.onBrand} />
        <Stat label={t('garage.statTrim')} value={vehicle.trim ?? '—'} labelColor={statLabel} valueColor={tokens.onBrand} />
      </AppView>

      {/* Actions — inverted-back-out primary + square tune button */}
      <AppView row gap={10} style={{ marginTop: 16 }}>
        <AppPressableView
          flex={1}
          center
          rounded={13}
          colorName="background"
          androidRipple
          onPress={() => onShopParts(vehicle.id)}
          accessibilityRole="button"
          accessibilityLabel={t('garage.shopPartsThatFit')}
          style={{ paddingVertical: 13, paddingHorizontal: 16 }}
        >
          <AppText family="accent" weight="bold" colorName="text" style={{ fontSize: 14 }}>
            {t('garage.shopPartsThatFit')}
          </AppText>
        </AppPressableView>

        <AppPressableView
          center
          rounded={13}
          onPress={() => onOpenDetail(vehicle.id)}
          accessibilityRole="button"
          accessibilityLabel={t('garage.vehicleDetails')}
          style={{ width: 46, backgroundColor: tuneWash }}
        >
          <SlidersHorizontal size={20} strokeWidth={2.2} color={tokens.onBrand} />
        </AppPressableView>
      </AppView>
    </AppView>
  );
}

export default GarageActiveHero;
