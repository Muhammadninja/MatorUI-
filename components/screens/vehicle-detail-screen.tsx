import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CarFront, Check, Pencil, Trash2, X } from 'lucide-react-native';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppTextField from '@/components/shared/app-text-field';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useLanguageContext } from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';
import VehicleColorPicker from '@/components/screens-components/garage/vehicle-color-picker';
import useGarage from '@/hooks/use-garage';
import type { VehiclePatch } from '@/services/garage-service';
import { toastService } from '@/services/toast-service';
import { formatMileage } from '@/utils/mileage';
import { colorEnumToHex, colorHexToEnum, nearestSwatch, normalizeHex } from '@/utils/vehicle-color';
import { formatUzPlate, isValidUzPlate, normalizeUzPlate, UZ_PLATE_DISPLAY_MAXLENGTH } from '@/utils/uz-plate';

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse a free-typed mileage string ("67,000 km") to a whole number, or
 *  undefined when the user cleared it. */
function parseMileage(raw: string): number | undefined {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 0) return undefined;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Vehicle Detail screen — reads the selected vehicle from the real
 * garage layer (`useGarage()`), keyed by the `id` route param and
 * falling back to the primary vehicle.
 *
 * Two modes:
 *   - **View** — headline + ACTIVE pill and a spec grid
 *     (VIN / Mileage / Trim / Color / Plate) with friendly "Not set"
 *     placeholders, plus "Set active" and "Edit details".
 *   - **Edit** — mileage / plate / color inputs saved through
 *     `useGarage().updateVehicle`. Opened by the header pencil or by
 *     launching the route with `?edit=1`.
 *
 * Setting active goes through `useActiveVehicle().setPrimaryVehicle` so
 * the parts-search scope stays in sync; deleting goes through
 * `useGarage().removeVehicle`, triggered by the trash icon.
 */
export default function VehicleDetailScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { id, edit } = useLocalSearchParams<{ id?: string; edit?: string }>();
  const { vehicles, primaryVehicle, updateVehicle, removeVehicle, isMutating } = useGarage();
  const { currentActiveVehicle, setPrimaryVehicle } = useActiveVehicle();
  const { language } = useLanguageContext();

  const vehicle = vehicles.find((v) => v.id === id) ?? primaryVehicle;

  // Edit form state. Seeded lazily from the resolved vehicle; a `null` form
  // means "view mode". Opening with `?edit=1` starts in edit mode.
  const seed = useCallback(
    () => ({
      mileage: vehicle?.mileage != null ? String(vehicle.mileage) : '',
      plate: formatUzPlate(vehicle?.plate ?? ''),
      colorHex: normalizeHex(vehicle?.colorHex ?? colorEnumToHex(vehicle?.color ?? 'midnight')),
    }),
    [vehicle],
  );
  const [form, setForm] = useState<ReturnType<typeof seed> | null>(
    edit === '1' && vehicle ? seed() : null,
  );
  const editing = form !== null;

  const isActive = currentActiveVehicle?.vehicleId === vehicle?.id;

  const openEdit = useCallback(() => setForm(seed()), [seed]);
  const cancelEdit = useCallback(() => setForm(null), []);

  // Capture the id so the async handlers keep a stable, non-undefined ref.
  const vehicleId = vehicle?.id;
  const headline = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '';

  const handleSave = useCallback(async () => {
    if (!form || !vehicleId || !vehicle) return;
    // Only send fields that actually changed — keeps the PATCH honest.
    const patch: VehiclePatch = {};
    const plate = normalizeUzPlate(form.plate);
    const mileage = parseMileage(form.mileage);
    if (plate !== normalizeUzPlate(vehicle.plate ?? '')) patch.plate = plate || undefined;
    if (mileage !== vehicle.mileage) patch.mileage = mileage;
    // Color is stored as hex (color_hex) — send that, and keep the legacy enum
    // in sync (nearest bucket) so mock/offline reads stay consistent.
    const currentHex = normalizeHex(vehicle.colorHex ?? colorEnumToHex(vehicle.color));
    if (form.colorHex !== currentHex) {
      patch.colorHex = form.colorHex;
      patch.color = colorHexToEnum(form.colorHex);
    }

    if (Object.keys(patch).length === 0) {
      setForm(null);
      return;
    }
    try {
      await updateVehicle(vehicleId, patch);
      setForm(null);
      toastService.success(t('vehicleDetail.savedToast'), { description: headline });
    } catch {
      toastService.danger(t('vehicleDetail.saveErrorToast'), {
        description: t('vehicleDetail.saveErrorToastDesc'),
      });
    }
  }, [form, vehicleId, vehicle, updateVehicle, t, headline]);

  const handleSetActive = useCallback(async () => {
    if (!vehicleId) return;
    await setPrimaryVehicle(vehicleId);
    toastService.success(t('vehicleDetail.activeSetToast'), { description: headline });
    router.back();
  }, [vehicleId, setPrimaryVehicle, t, headline]);

  const handleRemove = useCallback(async () => {
    if (!vehicleId) return;
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
  }, [vehicleId, removeVehicle, t, headline]);

  const notSet = t('vehicleDetail.notSet');
  const mileageValue = useMemo(
    () => formatMileage(vehicle?.mileage, t('vehicleDetail.mileageUnit'), language),
    [vehicle?.mileage, t, language],
  );

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

  const makeModel = `${vehicle.make} ${vehicle.model}`.toUpperCase();
  const subline = [vehicle.trim, vehicle.color ? titleCase(vehicle.color) : undefined]
    .filter(Boolean)
    .join(' · ');

  return (
    <AppView flex={1} colorName="background">
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 56 + 16, paddingBottom: 40 }}
      >
        {/* Info block */}
        <AppView px={20} mb={20} gap={8}>
          <AppView row align="center" gap={10} style={{ flexWrap: 'wrap' }}>
            <AppText family="heading" weight="bold" colorName="text" style={{ fontSize: 22, lineHeight: 28 }}>
              {headline}
            </AppText>
            {isActive ? (
              <AppView rounded={999} px={10} py={5} colorName="brand">
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
            <AppText family="default" colorName="textMuted" style={{ fontSize: 13.5, marginTop: 3 }}>
              {subline}
            </AppText>
          ) : null}
        </AppView>

        {editing ? (
          /* ── Edit form ─────────────────────────────────────────────── */
          <AppView px={20} gap={14}>
            <AppTextField
              label={`${t('vehicleDetail.mileage')} (${t('vehicleDetail.mileageUnit')})`}
              placeholder={t('vehicleDetail.mileagePlaceholder')}
              value={form.mileage}
              onChangeText={(v) => setForm((f) => (f ? { ...f, mileage: v } : f))}
              keyboardType="number-pad"
              maxLength={9}
              containerRounded={12}
              containerColorName="backgroundSecondary"
              containerBorderName="border"
            />
            <AppTextField
              label={t('vehicleDetail.plate')}
              placeholder={t('vehicleDetail.platePlaceholder')}
              value={form.plate}
              onChangeText={(v) => setForm((f) => (f ? { ...f, plate: formatUzPlate(v) } : f))}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
              maxLength={UZ_PLATE_DISPLAY_MAXLENGTH}
              errorText={form.plate.length > 0 && !isValidUzPlate(form.plate) ? t('vehicleDetail.plateInvalid') : undefined}
              containerRounded={12}
              containerColorName="backgroundSecondary"
              containerBorderName="border"
            />
            <VehicleColorPicker
              value={form.colorHex}
              onChange={(hex) => setForm((f) => (f ? { ...f, colorHex: hex } : f))}
            />

            <AppView row gap={10} style={{ marginTop: 6 }}>
              <AppView flex={1}>
                <AppButton title={t('common.cancel')} kind="secondary" size="lg" fullWidth onPress={cancelEdit} />
              </AppView>
              <AppView flex={1}>
                <AppButton
                  title={isMutating ? t('addVehicle.saving') : t('vehicleDetail.saveChanges')}
                  kind="brand"
                  size="lg"
                  fullWidth
                  disabled={isMutating}
                  onPress={handleSave}
                />
              </AppView>
            </AppView>
          </AppView>
        ) : (
          /* ── View: spec grid + actions ─────────────────────────────── */
          <>
            <AppView px={20} mb={24}>
              <AppView
                rounded={12}
                colorName="card"
                style={{ borderWidth: 1, borderColor: tokens.border, overflow: 'hidden' }}
              >
                <SpecRow>
                  <SpecCell label={t('vehicleDetail.vin')} value={vehicle.vin ?? notSet} muted={!vehicle.vin} tokens={tokens} />
                  <SpecDivider vertical tokens={tokens} />
                  <SpecCell label={t('vehicleDetail.mileage')} value={mileageValue || notSet} muted={!mileageValue} tokens={tokens} />
                </SpecRow>
                <SpecDivider tokens={tokens} />
                <SpecRow>
                  <SpecCell label={t('vehicleDetail.trim')} value={vehicle.trim ?? notSet} muted={!vehicle.trim} tokens={tokens} />
                  <SpecDivider vertical tokens={tokens} />
                  <SpecCell
                    label={t('vehicleDetail.color')}
                    value={nearestSwatch(vehicle.colorHex ?? colorEnumToHex(vehicle.color)).name}
                    tokens={tokens}
                    swatchHex={vehicle.colorHex ?? colorEnumToHex(vehicle.color)}
                  />
                </SpecRow>
                <SpecDivider tokens={tokens} />
                <SpecRow>
                  <SpecCell label={t('vehicleDetail.plate')} value={vehicle.plate ? formatUzPlate(vehicle.plate) : notSet} muted={!vehicle.plate} tokens={tokens} />
                </SpecRow>
              </AppView>
            </AppView>

            <AppView px={20} gap={10}>
              {!isActive ? (
                <AppButton title={t('vehicleDetail.setActive')} kind="brand" size="lg" fullWidth onPress={handleSetActive} />
              ) : null}
              <AppButton title={t('vehicleDetail.editDetails')} kind="secondary" size="lg" fullWidth onPress={openEdit} />
            </AppView>
          </>
        )}
      </ScrollView>

      {/* Header */}
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
          onPress={() => (editing ? cancelEdit() : router.back())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={editing ? t('common.cancel') : t('vehicleDetail.goBack')}
        >
          {editing ? (
            <X size={20} strokeWidth={2.2} color={tokens.text} />
          ) : (
            <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
          )}
        </AppPressableView>

        <AppText
          family="heading"
          weight="bold"
          colorName="text"
          numberOfLines={1}
          style={{ fontSize: 16, lineHeight: 22 }}
        >
          {editing ? t('vehicleDetail.editTitle') : makeModel}
        </AppText>

        {editing ? (
          // Save from the header too, so a long edit form is one tap away.
          <AppPressableView
            androidRipple={false}
            onPress={handleSave}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('vehicleDetail.saveChanges')}
            disabled={isMutating}
          >
            <Check size={20} strokeWidth={2.2} color={tokens.brand} />
          </AppPressableView>
        ) : (
          // View mode: edit + delete. Edit lives left of delete so the
          // destructive action stays in the far corner.
          <AppView row align="center" gap={18}>
            <AppPressableView
              androidRipple={false}
              onPress={openEdit}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('vehicleDetail.editDetails')}
            >
              <Pencil size={19} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
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
        )}
      </AppView>
    </AppView>
  );
}

// ─── Spec grid pieces ─────────────────────────────────────────────────────────

function SpecRow({ children }: { children: ReactNode }) {
  return (
    <AppView row style={styles.specRow}>
      {children}
    </AppView>
  );
}

function SpecDivider({ vertical, tokens }: { vertical?: boolean; tokens: { border: string } }) {
  return (
    <AppView style={[vertical ? styles.specDividerV : styles.specDividerH, { backgroundColor: tokens.border }]} />
  );
}

type SpecCellProps = {
  label: string;
  value: string;
  muted?: boolean;
  tokens: { textMuted: string; text: string; border: string };
  /** When set, renders a small colour swatch before the value (Color cell). */
  swatchHex?: string;
};

function SpecCell({ label, value, muted, tokens, swatchHex }: SpecCellProps) {
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
      <AppView row align="center" gap={7} style={{ marginTop: 3 }}>
        {swatchHex ? (
          <AppView
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              backgroundColor: swatchHex,
              borderWidth: 1,
              borderColor: tokens.border,
            }}
          />
        ) : null}
        <AppText
          family="default"
          weight="semibold"
          style={{ fontSize: 14, color: muted ? tokens.textMuted : tokens.text, flexShrink: 1 }}
          numberOfLines={2}
        >
          {value}
        </AppText>
      </AppView>
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
