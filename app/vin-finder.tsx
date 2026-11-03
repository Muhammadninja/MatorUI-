import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { apiClient } from '@/services/api-client';
import { normalizeVin } from '@/utils/vin';

/**
 * VIN Finder (Stage 1) — the shortest path from a raw VIN to a fitment
 * context. Enter a 17-char VIN, POST it to the decode endpoint, and pin the
 * decoded vehicle as the active fitment for the catalog. Deliberately thin:
 * one input, one submit, one result banner, one "browse systems" hand-off.
 *
 * Reachable via the `mator://vin-finder` deep link (used by the E2E suite) and
 * as a standalone route. The decode goes through `apiClient`, so it hits
 * whatever `EXPO_PUBLIC_API_BASE_URL` points at — the live Supabase gateway in
 * prod, or the offline Maestro mock server under test.
 */

type DecodeResponse = {
  success: boolean;
  car?: { make: string; model: string; year: number };
  error?: { code?: string; message?: string };
};

export default function VinFinderScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();

  const [vin, setVin] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [car, setCar] = useState<DecodeResponse['car'] | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const submit = useCallback(async () => {
    const clean = normalizeVin(vin);
    if (clean.length !== 17) {
      setStatus('error');
      setErrorMsg(t('vinFinder.vinLength'));
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await apiClient.post<DecodeResponse>('/v1/auth/decode-vin', { vin: clean });
      if (!res?.success || !res.car) {
        throw new Error(res?.error?.message ?? t('vinFinder.decodeFailed'));
      }
      setCar(res.car);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : t('vinFinder.decodeFailed'));
    }
  }, [vin, t]);

  const browseSystems = useCallback(() => {
    if (!car) return;
    router.push({ pathname: '/catalog', params: { make: car.make, model: car.model } });
  }, [car]);

  return (
    <AppView
      testID="vin-finder-screen"
      flex={1}
      colorName="background"
      style={{ paddingTop: insets.top + 24, paddingHorizontal: 16 }}
      gap={16}
    >
      <AppPressableView
        testID="vin-finder-back"
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/explore');
        }}
        row
        align="center"
        gap={8}
        style={{ minHeight: 48, alignSelf: 'flex-start' }}
      >
        <ArrowLeft size={20} color={tokens.text} />
        <AppText textVariant="bodySm">{t('common.back')}</AppText>
      </AppPressableView>
      <AppText
        family="heading"
        weight="bold"
        style={{ fontSize: 26, lineHeight: 32, color: tokens.text }}
      >
        {t('vinFinder.title')}
      </AppText>
      <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
        {t('vinFinder.subtitle')}
      </AppText>

      {/* VIN input */}
      <AppView
        rounded={12}
        px={16}
        colorName="surface"
        borderWidth={1}
        borderName="controlBorder"
        style={{ height: 52, justifyContent: 'center' }}
      >
        <TextInput
          testID="vin-input-field"
          value={vin}
          onChangeText={setVin}
          placeholder={t('vinFinder.placeholder')}
          placeholderTextColor={tokens.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={17}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={{ fontSize: 16, letterSpacing: 1, color: tokens.text, paddingVertical: 0 }}
        />
      </AppView>

      {/* Submit */}
      <AppPressableView
        testID="vin-submit-button"
        onPress={submit}
        accessibilityRole="button"
        accessibilityLabel={t('vinFinder.decode')}
        pressedOpacity={0.85}
        center
        rounded={14}
        py={15}
        style={{ backgroundColor: tokens.brandBg, opacity: status === 'loading' ? 0.6 : 1 }}
      >
        <AppText family="accent" weight="bold" style={{ fontSize: 15, color: tokens.onBrand }}>
          {status === 'loading' ? t('vinFinder.decoding') : t('vinFinder.findParts')}
        </AppText>
      </AppPressableView>

      {status === 'error' ? (
        <AppText testID="vin-error" family="default" style={{ fontSize: 13, color: tokens.error }}>
          {errorMsg}
        </AppText>
      ) : null}

      {/* Decoded fitment banner — the dynamic vehicle widget bar. */}
      {car ? (
        <AppView
          testID="vehicle-fitment-bar"
          row
          align="center"
          gap={10}
          px={16}
          py={14}
          rounded={14}
          colorName="card"
          borderWidth={1}
          style={{ borderColor: tokens.success }}
        >
          <AppView
            testID="fitment-status-indicator"
            rounded={999}
            style={{ width: 9, height: 9, backgroundColor: tokens.success }}
          />
          <AppText family="accent" weight="bold" style={{ flex: 1, fontSize: 14, color: tokens.text }}>
            {t('vinFinder.fittingFor', { vehicle: `${car.year} ${car.make} ${car.model}` })}
          </AppText>
        </AppView>
      ) : null}

      {car ? (
        <AppPressableView
          testID="browse-systems-btn"
          onPress={browseSystems}
          accessibilityRole="button"
          accessibilityLabel={t('vinFinder.browseSystems')}
          pressedOpacity={0.85}
          center
          rounded={14}
          py={15}
          borderWidth={1}
          borderName="border"
        >
          <AppText family="accent" weight="bold" style={{ fontSize: 15, color: tokens.text }}>
            {t('vinFinder.browseSystemsCta')}
          </AppText>
        </AppPressableView>
      ) : null}
    </AppView>
  );
}
