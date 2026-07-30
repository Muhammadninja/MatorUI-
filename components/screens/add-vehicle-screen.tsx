import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import useGarage from '@/hooks/use-garage';
import { toastService } from '@/services/toast-service';
import { VinDecoderService, type DecodedVehicle } from '@/services/vin-decoder-service';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Add Vehicle screen — VIN decoder. Enter a 17-character VIN and it runs through
 * `VinDecoderService` (NHTSA), which auto-fills Make / Model / Year from the
 * decoded record; "Save vehicle" adds it to the garage. Local state only — no
 * camera / scanner.
 */
export default function AddVehicleScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { addVehicle, isMutating } = useGarage();

  const [vin, setVin] = useState('');
  const [decoded, setDecoded] = useState<DecodedVehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const [decoding, setDecoding] = useState(false);

  // This screen is VIN-only: Make / Model / Year come from the decoder, so Save
  // is gated entirely on a successful decode that resolved all three.
  const canSave =
    !!decoded && decoded.make.length > 0 && decoded.model.length > 0 && decoded.year > 0;

  // Editing the VIN after a decode invalidates the preview.
  const handleVinChange = useCallback((next: string) => {
    setVin(next);
    setDecoded((prev) => (prev && prev.vin !== next.trim().toUpperCase() ? null : prev));
  }, []);

  const handleSave = useCallback(async () => {
    if (!decoded || !canSave) {
      triggerHaptic('warning');
      toastService.info('Decode a VIN first', {
        description: 'Enter a 17-character VIN to identify the vehicle.',
      });
      return;
    }
    triggerHaptic('success');
    setSaving(true);
    try {
      // Add through the real garage layer. `setAsPrimary` makes it the active
      // vehicle (turning on fitment UI across the app). This minimal form
      // doesn't collect a color — default to 'midnight'; the full wizard lets
      // the user pick one.
      await addVehicle({
        make: decoded.make,
        model: decoded.model,
        year: decoded.year,
        vin: decoded.vin || vin.trim() || undefined,
        color: 'midnight',
        setAsPrimary: true,
      });
      toastService.success('Vehicle added', {
        description: `${decoded.year} ${decoded.make} ${decoded.model}`,
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
  }, [decoded, canSave, vin, addVehicle]);

  // Decode a VIN via the provider-agnostic VinDecoderService. Never throws —
  // domain errors surface as a screen-local toast so a provider outage can't
  // take the form down.
  const applyDecodedVin = useCallback(async (rawVin: string) => {
    if (rawVin.trim().length === 0) return;
    setDecoding(true);
    const result = await VinDecoderService.decodeSafe(rawVin);
    setDecoding(false);

    if (!result.ok) {
      setDecoded(null);
      triggerHaptic('warning');
      toastService.danger('Couldn’t decode VIN', { description: result.error.message });
      return;
    }

    setDecoded(result.data);
    if (result.data.isVerified) {
      triggerHaptic('success');
      toastService.success('Vehicle identified', {
        description: `${result.data.year} ${result.data.make} ${result.data.model}`.trim(),
      });
    } else {
      triggerHaptic('warning');
      toastService.info('Partial VIN match', {
        description: 'We couldn’t fully identify this VIN — try another.',
      });
    }
  }, []);

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
          {/* Intro */}
          <AppText
            family="default"
            colorName="textMuted"
            style={{ fontSize: 13.5, lineHeight: 20 }}
          >
            Enter your 17-character VIN — we’ll identify the make, model, and year
            automatically.
          </AppText>

          {/* VIN input */}
          <AppTextField
            label="VIN"
            placeholder="17-character VIN"
            value={vin}
            onChangeText={handleVinChange}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={17}
            containerRounded={12}
            containerColorName="backgroundSecondary"
            containerBorderName="border"
          />

          {/* Decode action — appears once a full 17-char VIN is present */}
          {vin.trim().length === 17 && !decoded ? (
            <AppPressableView
              row
              align="center"
              gap={8}
              onPress={() => applyDecodedVin(vin)}
              disabled={decoding}
              androidRipple={false}
              accessibilityRole="button"
              accessibilityLabel="Identify vehicle from VIN"
              style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
            >
              {decoding ? (
                <WheelLoader size={16} color={tokens.brand} />
              ) : (
                <Sparkles size={15} strokeWidth={2.2} color={tokens.brand} />
              )}
              <AppText
                family="accent"
                weight="semibold"
                style={{ fontSize: 13, color: tokens.brand }}
              >
                {decoding ? 'Decoding VIN…' : 'Identify vehicle from VIN'}
              </AppText>
            </AppPressableView>
          ) : null}

          {/* Decoded vehicle preview */}
          {decoded ? (
            <AppView
              rounded={14}
              colorName="card"
              style={{ borderWidth: 1, borderColor: tokens.border, padding: 16, gap: 12 }}
            >
              <AppView row align="center" justify="space-between">
                <AppText
                  family="accent"
                  weight="bold"
                  colorName="textMuted"
                  style={{ fontSize: 11, letterSpacing: 0.7 }}
                  transform="uppercase"
                >
                  Decoded vehicle
                </AppText>
                <AppView
                  rounded={999}
                  px={9}
                  py={4}
                  style={{
                    backgroundColor: `${decoded.isVerified ? tokens.success : tokens.warning}22`,
                  }}
                >
                  <AppText
                    family="accent"
                    weight="bold"
                    style={{
                      fontSize: 10,
                      letterSpacing: 0.5,
                      color: decoded.isVerified ? tokens.success : tokens.warning,
                    }}
                    transform="uppercase"
                  >
                    {decoded.isVerified ? 'Verified' : 'Partial'}
                  </AppText>
                </AppView>
              </AppView>

              <AppText family="heading" weight="bold" colorName="text" style={{ fontSize: 18 }}>
                {[decoded.year > 0 ? decoded.year : null, decoded.make, decoded.model]
                  .filter(Boolean)
                  .join(' ') || 'Unidentified vehicle'}
              </AppText>

              {decoded.engineDisplacement || decoded.fuelType ? (
                <AppView row gap={8} style={{ flexWrap: 'wrap' }}>
                  {decoded.engineDisplacement ? (
                    <SpecChip label={`${decoded.engineDisplacement} L`} />
                  ) : null}
                  {decoded.fuelType ? <SpecChip label={decoded.fuelType} /> : null}
                </AppView>
              ) : null}

              <AppText family="mono" colorName="textMuted" style={{ fontSize: 12 }}>
                {decoded.vin}
              </AppText>
            </AppView>
          ) : null}
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
    </AppView>
  );
}

function SpecChip({ label }: { label: string }) {
  const { tokens } = useThemeContext();
  return (
    <AppView rounded={8} px={10} py={5} colorName="backgroundSecondary" borderWidth={1} borderName="border">
      <AppText family="default" weight="semibold" style={{ fontSize: 12.5, color: tokens.text }}>
        {label}
      </AppText>
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
