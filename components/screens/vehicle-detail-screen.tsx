import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CarFront, Trash2 } from 'lucide-react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppImage from '@/components/shared/app-image';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import useGarage from '@/hooks/use-garage';
import { toastService } from '@/services/toast-service';

function formatMileage(km: number | undefined, unit: string): string {
  if (km === undefined) return '—';
  return `${km.toLocaleString('en-US')} ${unit}`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Vehicle Detail screen — reads the selected vehicle from the real
 * garage layer (`useGarage()`), keyed by the `id` route param and
 * falling back to the primary vehicle.
 *
 * Shows the vehicle photo, year/make/model headline + ACTIVE pill,
 * trim·color subline, a 2-col spec grid (VIN / Mileage / Trim / Color),
 * and a "Set active" action button.
 *
 * Setting active goes through `useActiveVehicle().setPrimaryVehicle` so
 * the parts-search scope stays in sync; deleting goes through
 * `useGarage().removeVehicle`, triggered by the trash icon in the header.
 */
export default function VehicleDetailScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { vehicles, primaryVehicle, removeVehicle } = useGarage();
  const { currentActiveVehicle, setPrimaryVehicle } = useActiveVehicle();

  const vehicle = vehicles.find((v) => v.id === id) ?? primaryVehicle;

  // No vehicles in the garage (or none matched) — nothing to show.
  if (!vehicle) {
    return (
      <AppView flex={1} center colorName="background" px={20} gap={12}>
        <CarFront size={34} strokeWidth={2} color={tokens.textMuted} />
        <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
          {t('vehicleDetail.notFound')}
        </AppText>
        <AppButton title={t('vehicleDetail.backToGarage')} kind="secondary" size="sm" onPress={() => router.back()} />
      </AppView>
    );
  }

  const isActive = currentActiveVehicle?.vehicleId === vehicle.id;

  const makeModel = `${vehicle.make} ${vehicle.model}`.toUpperCase();
  const headline = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const vinValue = vehicle.vin ?? '—';
  const trimValue = vehicle.trim ?? '—';
  const mileageValue = formatMileage(vehicle.mileage, t('vehicleDetail.mileageUnit'));
  const colorValue = vehicle.color ? titleCase(vehicle.color) : '—';
  const subline = [vehicle.trim, vehicle.color ? titleCase(vehicle.color) : undefined]
    .filter(Boolean)
    .join(' · ');
  // Real photo only; when absent, AppImage renders the car-placeholder fallback.
  const imageSource = vehicle.images?.[0];
  // Capture the id so the async handlers below keep the narrowed
  // (non-undefined) reference past the early-return guard above.
  const vehicleId = vehicle.id;

  async function handleSetActive() {
    await setPrimaryVehicle(vehicleId);
    toastService.success(t('vehicleDetail.activeSetToast'), { description: headline });
    router.back();
  }

  async function handleRemove() {
    try {
      await removeVehicle(vehicleId);
      toastService.info(t('vehicleDetail.removedToast', { vehicle: headline }), {
        description: t('vehicleDetail.removedToastDesc'),
      });
      router.back();
    } catch {
      toastService.danger(t('vehicleDetail.removeErrorToast'), {
        description: t('vehicleDetail.removeErrorToastDesc'),
      });
    }
  }

  return (
    <AppView flex={1} colorName="background">
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 56 + 16, paddingBottom: 40 }}
      >
        {/* Vehicle image */}
        <AppView px={20} mb={20}>
          <AppImage
            source={imageSource}
            height={170}
            rounded={18}
            contentFit="cover"
            priority="high"
            cachePolicy="memory-disk"
            transition={180}
            alt={t('vehicleDetail.photoAlt', { vehicle: headline })}
            fallback={
              <AppView flex={1} center colorName="backgroundSecondary">
                <CarFront size={40} strokeWidth={2} color={tokens.gray400} />
              </AppView>
            }
          />
        </AppView>

        {/* Info block */}
        <AppView px={20} mb={24} gap={8}>
          <AppView row align="center" gap={10} style={{ flexWrap: 'wrap' }}>
            <AppText
              family="heading"
              weight="bold"
              colorName="text"
              style={{ fontSize: 22, lineHeight: 28 }}
            >
              {headline}
            </AppText>
            {isActive ? (
              <AppView
                rounded={999}
                px={10}
                py={5}
                colorName="brand"
              >
                <AppText
                  family="accent"
                  weight="bold"
                  colorName="onBrand"
                  style={{ fontSize: 10, letterSpacing: 0.8 }}
                  transform="uppercase"
                >
                  {t('vehicleDetail.activePill')}
                </AppText>
              </AppView>
            ) : null}
          </AppView>
          {subline ? (
            <AppText
              family="default"
              colorName="textMuted"
              style={{ fontSize: 13.5, marginTop: 3 }}
            >
              {subline}
            </AppText>
          ) : null}
        </AppView>

        {/* 2-col spec grid */}
        <AppView px={20} mb={24}>
          <AppView
            rounded={12}
            colorName="card"
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              overflow: 'hidden',
            }}
          >
            {/* Row 1: VIN + Mileage */}
            <AppView row style={styles.specRow}>
              <SpecCell label={t('vehicleDetail.vin')} value={vinValue} />
              <AppView style={[styles.specDividerV, { backgroundColor: tokens.border }]} />
              <SpecCell label={t('vehicleDetail.mileage')} value={mileageValue} />
            </AppView>
            <AppView style={[styles.specDividerH, { backgroundColor: tokens.border }]} />
            {/* Row 2: Trim + Color */}
            <AppView row style={styles.specRow}>
              <SpecCell label={t('vehicleDetail.trim')} value={trimValue} />
              <AppView style={[styles.specDividerV, { backgroundColor: tokens.border }]} />
              <SpecCell label={t('vehicleDetail.color')} value={colorValue} />
            </AppView>
          </AppView>
        </AppView>

        {/* Action buttons */}
        {!isActive ? (
          <AppView px={20} style={{ marginTop: 4 }}>
            <AppButton
              title={t('vehicleDetail.setActive')}
              kind="brand"
              size="lg"
              fullWidth
              onPress={handleSetActive}
            />
          </AppView>
        ) : null}
      </ScrollView>

      {/* Blur header */}
      <AppView
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: tokens.background,
          borderBottomWidth: 1,
          borderBottomColor: tokens.divider,
        }}
      >
        <AppPressableView
          androidRipple={false}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('vehicleDetail.goBack')}
        >
          <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
        </AppPressableView>

        <AppText
          family="heading"
          weight="bold"
          colorName="text"
          numberOfLines={1}
          style={{ fontSize: 16, lineHeight: 22 }}
        >
          {makeModel}
        </AppText>

        {/* Delete vehicle */}
        <AppPressableView
          androidRipple={false}
          onPress={handleRemove}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('vehicleDetail.deleteVehicle')}
        >
          <Trash2 size={20} strokeWidth={2.2} color={tokens.error} />
        </AppPressableView>
      </AppView>
    </AppView>
  );
}

// ─── Spec Cell ────────────────────────────────────────────────────────────────

type SpecCellProps = { label: string; value: string };

function SpecCell({ label, value }: SpecCellProps) {
  return (
    <AppView flex={1} px={14} py={12} gap={4}>
      <AppText
        family="accent"
        weight="semibold"
        colorName="textMuted"
        style={{ fontSize: 11, letterSpacing: 0.7 }}
        transform="uppercase"
      >
        {label}
      </AppText>
      <AppText
        family="default"
        weight="semibold"
        colorName="text"
        style={{ fontSize: 14, marginTop: 3 }}
        numberOfLines={2}
      >
        {value}
      </AppText>
    </AppView>
  );
}

const styles = StyleSheet.create({
  specRow: {
    alignItems: 'stretch',
  },
  specDividerV: {
    width: 1,
  },
  specDividerH: {
    height: 1,
  },
});
