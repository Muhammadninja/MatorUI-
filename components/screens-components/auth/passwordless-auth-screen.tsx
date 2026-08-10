import { router } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl } from '@/config/api';
import { ApiError } from '@/services/api-client';
import { triggerHaptic } from '@/utils/haptics';

/** Turn a request/verify failure into a user-facing description. A 429
 *  (global rate limit) gets an explicit "too many attempts" message that
 *  honors the server's `Retry-After` cooldown; everything else surfaces the
 *  backend's own message. */
function describeAuthError(
  err: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | undefined {
  if (err instanceof ApiError && err.isRateLimited) {
    return err.retryAfterSeconds
      ? t('auth.tooManyAttemptsRetry', { seconds: err.retryAfterSeconds })
      : t('auth.tooManyAttempts');
  }
  return err instanceof Error ? err.message : undefined;
}

/** DEMO/E2E prefill so the offline Maestro suite stays buttons-only (no typing).
 *  Only used against a demo backend — a real remote backend starts on an empty
 *  field so users type their own number (no seeded demo phone in production). */
const DEMO_PHONE = '+998 90 123 45 67';

/** Remembers the last phone typed so a simulator reload doesn't wipe it. */
const LAST_PHONE_KEY = 'mator.last_phone';

/** True only for a DEMO backend: the pure offline mock (no base URL) or the
 *  local E2E mock server (localhost). A real remote backend — dev, staging, or
 *  prod (api.mator.uz) — is NOT demo, so the phone field starts empty. Evaluated
 *  once at module load (env-driven, never changes at runtime). */
const IS_DEMO_AUTH: boolean = (() => {
  const base = getApiBaseUrl();
  if (base === null) return true; // pure offline mock
  return /\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/|$)/i.test(base); // E2E mock server
})();

/** Minimal sanity check: E.164-ish — an optional leading '+' then 9–15 digits
 *  (an Uzbek MSISDN is +998 + 9 digits = 12). We keep this loose on purpose; the
 *  backend is the source of truth for validity, this only stops obviously-empty
 *  or too-short submissions. */
function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/[^\d]/g, '');
  return /^\+?\d[\d\s()-]*$/.test(raw.trim()) && digits.length >= 9 && digits.length <= 15;
}

/** Leave the auth sheet, returning to whatever screen pushed it. */
function dismiss() {
  if (router.canGoBack()) router.back();
  else router.replace('/explore');
}

/**
 * Unified phone-number auth, presented as a small bottom sheet (the route is a
 * `transparentModal`, see `app/(auth)/_layout.tsx`). One flow for everyone — no
 * separate "sign in" vs "create account": the user enters their phone, taps
 * Next, and we text a one-time code. Existing numbers are matched to their
 * account; new numbers get one created (backend decides from `purpose`).
 *
 * Two phases in the same sheet: phone → code. On success we `router.back()` to
 * wherever the flow was triggered (e.g. the purchase gate returns to the item).
 *
 * DEMO/E2E: the mock `requestOtp` returns a `devCode` we auto-fill so the offline
 * suite stays buttons-only; a real backend omits it and the user types the code.
 */
export default function PasswordlessAuthScreen() {
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t } = useTranslation();
  const { requestOtp, verifyOtp, isLoading } = useUserContext();

  // Slide the panel up over the (fading) scrim on mount so the screen underneath
  // stays put, matching the app's other bottom sheets.
  const translateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 90,
      friction: 12,
    }).start();
  }, [translateY]);

  const [phase, setPhase] = useState<'phone' | 'otp'>('phone');
  // Real remote backends start empty (users type their number); the demo/E2E
  // mock prefills the demo phone so the offline suite stays buttons-only.
  const [phone, setPhone] = useState(IS_DEMO_AUTH ? DEMO_PHONE : '');
  const [code, setCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);

  // Prefill the last-used number on reload (real backends only — demo already
  // seeds its own). So the simulator "remembers" the account across reloads.
  useEffect(() => {
    if (IS_DEMO_AUTH) return;
    AsyncStorage.getItem(LAST_PHONE_KEY)
      .then((saved) => {
        if (saved) setPhone(saved);
      })
      .catch(() => undefined);
  }, []);

  const phoneValid = isValidPhone(phone);

  const field = {
    containerRounded: 12 as const,
    containerColorName: 'backgroundSecondary' as const,
    containerBorderName: 'border' as const,
  };

  const sendCode = async () => {
    if (isLoading) return;
    const identifier = phone.trim();
    if (!isValidPhone(identifier)) {
      triggerHaptic('error');
      toast.danger(identifier ? t('auth.enterValidPhone') : t('auth.enterPhone'));
      return;
    }
    try {
      const { otpToken: token, devCode } = await requestOtp({
        channel: 'phone',
        identifier,
        // Unified flow: the backend upserts by phone. See file header.
        purpose: 'sign-in',
      });
      triggerHaptic('success');
      setOtpToken(token);
      // Remember this number so a reload prefills it next time.
      AsyncStorage.setItem(LAST_PHONE_KEY, identifier).catch(() => undefined);
      // DEMO/E2E: auto-fill the code the mock handed back. Real backends omit it.
      setCode(devCode ?? '');
      setPhase('otp');
      toast.info(t('auth.codeSentTo', { phone: identifier }));
    } catch (err) {
      triggerHaptic('error');
      toast.danger(t('auth.couldNotSend'), { description: describeAuthError(err, t) });
    }
  };

  const verify = async () => {
    if (isLoading || !otpToken) return;
    try {
      await verifyOtp({ otpToken, code: code.trim() });
      triggerHaptic('success');
      dismiss();
    } catch (err) {
      triggerHaptic('error');
      toast.danger(t('auth.codeDidNotWork'), { description: describeAuthError(err, t) });
    }
  };

  const resend = async () => {
    if (isLoading) return;
    try {
      const { otpToken: token, devCode } = await requestOtp({
        channel: 'phone',
        identifier: phone.trim(),
        purpose: 'sign-in',
      });
      setOtpToken(token);
      setCode(devCode ?? '');
      toast.info(t('auth.newCodeSent'));
    } catch (err) {
      toast.danger(t('auth.couldNotResend'), { description: describeAuthError(err, t) });
    }
  };

  const onBack = () => {
    triggerHaptic('selection');
    if (phase === 'otp') setPhase('phone');
    else dismiss();
  };

  return (
    <AppView flex={1} justify="flex-end" testID="sign-in-screen" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
      {/* Backdrop — tap to dismiss. */}
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={dismiss}
        accessibilityLabel={t('auth.dismiss')}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={{ transform: [{ translateY }] }}>
        <AppView
          roundedTop={28}
          px={20}
          pt={10}
          gap={16}
          style={{
            width: '100%',
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: tokens.border,
            backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            paddingBottom: insets.bottom + 20,
          }}
        >
          {/* Drag handle */}
          <AppView center>
            <AppView rounded={999} style={{ width: 44, height: 5, backgroundColor: tokens.divider }} />
          </AppView>

          {/* Header row: back (otp phase only) + close */}
          <AppView row justify="space-between" align="center">
            {phase === 'otp' ? (
              <AppPressableView
                onPress={onBack}
                center
                rounded={999}
                accessibilityRole="button"
                accessibilityLabel={t('auth.back')}
                style={{ width: 34, height: 34, borderWidth: 1, borderColor: tokens.border }}
              >
                <ArrowLeft size={18} strokeWidth={2.2} color={tokens.text} />
              </AppPressableView>
            ) : (
              <AppView />
            )}
            <AppPressableView
              testID="auth-close-btn"
              onPress={() => {
                triggerHaptic('selection');
                dismiss();
              }}
              center
              rounded={999}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={{ width: 34, height: 34, borderWidth: 1, borderColor: tokens.border }}
            >
              <X size={16} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
          </AppView>

          {phase === 'phone' ? (
            <>
              <AppView gap={6}>
                <AppText family="heading" weight="bold" style={{ fontSize: 22, lineHeight: 28, color: tokens.text }}>
                  {t('auth.logInOrSignUp')}
                </AppText>
                <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
                  {t('auth.phoneSubtitle')}
                </AppText>
              </AppView>

              <AppTextField
                testID="auth-phone-field"
                label={t('auth.phoneLabel')}
                placeholder="+998 90 123 45 67"
                value={phone}
                onChangeText={setPhone}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                {...field}
              />

              <AppButton
                testID="auth-send-code-btn"
                title={isLoading ? t('auth.sendingCode') : t('auth.next')}
                kind="brand"
                size="lg"
                fullWidth
                disabled={isLoading || !phoneValid}
                onPress={sendCode}
              />
              <AppText family="default" style={{ fontSize: 11, color: tokens.textMuted, textAlign: 'center', lineHeight: 16 }}>
                {t('auth.termsNotice')}
              </AppText>
            </>
          ) : (
            <>
              <AppView gap={6}>
                <AppText family="heading" weight="bold" style={{ fontSize: 22, lineHeight: 28, color: tokens.text }}>
                  {t('auth.enterCode')}
                </AppText>
                <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
                  {t('auth.codeSentDetail', { phone: phone.trim() })}
                </AppText>
              </AppView>

              <AppTextField
                testID="auth-otp-field"
                label={t('auth.verificationCodeLabel')}
                placeholder="123456"
                value={code}
                onChangeText={(v: string) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                {...field}
              />

              <AppButton
                testID="auth-verify-btn"
                title={isLoading ? t('auth.verifying') : t('auth.verifyContinue')}
                kind="brand"
                size="lg"
                fullWidth
                disabled={isLoading || code.length < 6}
                onPress={verify}
              />

              <AppPressableView
                onPress={resend}
                disabled={isLoading}
                center
                accessibilityRole="button"
                accessibilityLabel={t('auth.resendCode')}
              >
                <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
                  {t('auth.didntGetItResend')}
                </AppText>
              </AppPressableView>
            </>
          )}
        </AppView>
        </Animated.View>
      </KeyboardAvoidingView>
    </AppView>
  );
}
