import { router } from 'expo-router';
import { ScanLine } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import VinScannerModal from '@/components/screens-components/vin-scanner/vin-scanner-modal';
import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import useGarage from '@/hooks/use-garage';
import { toastService } from '@/services/toast-service';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Add Vehicle screen — faithful rebuild of the prototype's `scAddVehicle`.
 *
 * Fields: Make / Model (side by side), Year, "OR ENTER VIN" divider,
 * VIN input + "Scan VIN" button, and a "Save vehicle" CTA. Local state only.
 */
export default function AddVehicleScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { addVehicle, isMutating } = useGarage();

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ make?: string; model?: string; year?: string }>({});

  // Save can only proceed with the three required fields filled and a
  // parseable year — mirrors validate() so the CTA can disable itself.
  const yearNum = parseInt(year, 10);
  const canSave =
    make.trim().length > 0 &&
    model.trim().length > 0 &&
    year.trim().length > 0 &&
    !isNaN(yearNum) &&
    yearNum >= 1900 &&
    yearNum <= 2100;

  const validate = useCallback(() => {
    const e: typeof errors = {};
    const yearNum = parseInt(year, 10);
    if (!make.trim()) e.make = 'Required';
    if (!model.trim()) e.model = 'Required';
    if (!year.trim()) {
      e.year = 'Required';
    } else if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      e.year = 'Enter a valid year';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [make, model, year]);

  const handleSave = useCallback(async () => {
    if (!validate()) {
      triggerHaptic('warning');
      return;
    }
    triggerHaptic('success');
    setSaving(true);
    try {
      // Add through the real garage layer. `setAsPrimary` makes it the
      // active vehicle (turning on fitment UI across the app), mirroring
      // the old mock behaviour. This screen's minimal form doesn't
      // collect a color — default to 'midnight' (the wizard's default);
      // the full add-vehicle wizard lets the user pick one.
      await addVehicle({
        make: make.trim(),
        model: model.trim(),
        year: parseInt(year, 10),
        vin: vin.trim() || undefined,
        color: 'midnight',
        setAsPrimary: true,
      });
      toastService.success('Vehicle added', {
        description: `${year} ${make.trim()} ${model.trim()}`,
      });
      router.back();
    } catch {
      // useGarage() already surfaces the error state; the toast below
      // gives the user immediate, screen-local feedback.
      toastService.danger('Couldn’t add vehicle', {
        description: 'Please check your connection and try again.',
      });
    } finally {
      setSaving(false);
    }
  }, [validate, year, make, model, vin, addVehicle]);

  const handleBarcodeScanned = useCallback(
    (raw: string) => {
      triggerHaptic('success');
      setVin(raw);
      toastService.success('VIN detected', { description: raw });
      setScannerVisible(false);
    },
    [],
  );

  return (
    <AppView flex={1} colorName="background">
      {/* Header */}
      <AppView
        row
        align="center"
        px={20}
        gap={12}
        style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
      >
        <AppPressableView
          center
          rounded={12}
          borderWidth={1}
          borderName="border"
          androidRipple={false}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ width: 40, height: 40 }}
        >
          <AppText colorName="text" style={{ fontSize: 20 }}>‹</AppText>
        </AppPressableView>
        <AppText
          family="heading"
          weight="bold"
          colorName="text"
          style={{ fontSize: 20, lineHeight: 26 }}
          accessibilityRole="header"
        >
          Add vehicle
        </AppText>
      </AppView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Make / Model row */}
          <AppView row gap={12}>
            <AppView flex={1}>
              <AppTextField
                label="Make"
                placeholder="Toyota"
                value={make}
                onChangeText={setMake}
                autoCapitalize="words"
                autoCorrect={false}
                errorText={errors.make}
                containerRounded={12}
                containerColorName="backgroundSecondary"
                containerBorderName="border"
              />
            </AppView>
            <AppView flex={1}>
              <AppTextField
                label="Model"
                placeholder="Corolla"
                value={model}
                onChangeText={setModel}
                autoCapitalize="words"
                autoCorrect={false}
                errorText={errors.model}
                containerRounded={12}
                containerColorName="backgroundSecondary"
                containerBorderName="border"
              />
            </AppView>
          </AppView>

          {/* Year */}
          <AppTextField
            label="Year"
            placeholder="2022"
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            errorText={errors.year}
            containerRounded={12}
            containerColorName="backgroundSecondary"
            containerBorderName="border"
          />

          {/* OR ENTER VIN divider */}
          <AppView row align="center" gap={12} style={{ marginVertical: 4 }}>
            <AppView flex={1} style={{ height: 1, backgroundColor: tokens.divider }} />
            <AppText
              family="accent"
              weight="semibold"
              colorName="textMuted"
              style={{ fontSize: 12, letterSpacing: 1 }}
              transform="uppercase"
            >
              Or enter VIN
            </AppText>
            <AppView flex={1} style={{ height: 1, backgroundColor: tokens.divider }} />
          </AppView>

          {/* VIN input + Scan VIN button */}
          <AppView row gap={10} align="flex-end">
            <AppView flex={1}>
              <AppTextField
                label="VIN"
                placeholder="17-character VIN"
                value={vin}
                onChangeText={setVin}
                autoCapitalize="characters"
                autoCorrect={false}
                containerRounded={12}
                containerColorName="backgroundSecondary"
                containerBorderName="border"
              />
            </AppView>
            <AppPressableView
              center
              rounded={12}
              px={16}
              colorName="brand"
              androidRipple
              onPress={() => {
                triggerHaptic('selection');
                setScannerVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Scan VIN with camera"
              style={{ height: 50, flexDirection: 'row', gap: 6 }}
            >
              <ScanLine size={16} strokeWidth={2} color={tokens.onBrand} />
              <AppText
                family="accent"
                weight="bold"
                colorName="onBrand"
                style={{ fontSize: 13 }}
              >
                Scan VIN
              </AppText>
            </AppPressableView>
          </AppView>
        </ScrollView>

        {/* Save button pinned to bottom */}
        <AppView
          px={20}
          pb={Math.max(insets.bottom, 16)}
          pt={12}
          colorName="background"
          borderTopWidth={1}
          borderName="divider"
        >
          <AppButton
            title={saving || isMutating ? 'Saving…' : 'Save vehicle'}
            kind="brand"
            size="lg"
            fullWidth
            disabled={saving || isMutating || !canSave}
            onPress={handleSave}
          />
        </AppView>
      </KeyboardAvoidingView>

      <VinScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />
    </AppView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
});
