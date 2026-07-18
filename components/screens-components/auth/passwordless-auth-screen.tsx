import { router } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/services/api-client';
import { triggerHaptic } from '@/utils/haptics';

/** Turn a request/verify failure into a user-facing description. A 429
 *  (global rate limit) gets an explicit "too many attempts" message that
 *  honors the server's `Retry-After` cooldown; everything else surfaces the
 *  backend's own message. */
function describeAuthError(err: unknown): string | undefined {
  if (err instanceof ApiError && err.isRateLimited) {
    return err.retryAfterSeconds
      ? `Too many attempts. Try again in ${err.retryAfterSeconds}s.`
      : 'Too many attempts. Please wait a moment and try again.';
  }
  return err instanceof Error ? err.message : undefined;
}

/** DEMO/E2E prefill so the offline Maestro suite stays buttons-only (no typing).
 *  Clear for the real backend build. */
const DEMO_PHONE = '+998 90 123 45 67';

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
  const { requestOtp, verifyOtp, isLoading } = useUserContext();

  const [phase, setPhase] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState(DEMO_PHONE);
  const [code, setCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);

  const field = {
    containerRounded: 12 as const,
    containerColorName: 'backgroundSecondary' as const,
    containerBorderName: 'border' as const,
  };

  const sendCode = async () => {
    if (isLoading) return;
    const identifier = phone.trim();
    if (!identifier) {
      triggerHaptic('error');
      toast.danger('Enter your phone number');
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
      // DEMO/E2E: auto-fill the code the mock handed back. Real backends omit it.
      setCode(devCode ?? '');
      setPhase('otp');
      toast.info(`Code sent to ${identifier}`);
    } catch (err) {
      triggerHaptic('error');
      toast.danger('Could not send the code', { description: describeAuthError(err) });
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
      toast.danger('That code did not work', { description: describeAuthError(err) });
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
      toast.info('New code sent');
    } catch (err) {
      toast.danger('Could not resend the code', { description: describeAuthError(err) });
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
        accessibilityLabel="Dismiss"
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                accessibilityLabel="Back"
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
              accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderWidth: 1, borderColor: tokens.border }}
            >
              <X size={16} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
          </AppView>

          {phase === 'phone' ? (
            <>
              <AppView gap={6}>
                <AppText family="heading" weight="bold" style={{ fontSize: 22, lineHeight: 28, color: tokens.text }}>
                  Log in or sign up
                </AppText>
                <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
                  Enter your phone number — we’ll text you a code.
                </AppText>
              </AppView>

              <AppTextField
                testID="auth-phone-field"
                label="Phone number"
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
                title={isLoading ? 'Sending code…' : 'Next'}
                kind="brand"
                size="lg"
                fullWidth
                disabled={isLoading}
                onPress={sendCode}
              />
              <AppText family="default" style={{ fontSize: 11, color: tokens.textMuted, textAlign: 'center', lineHeight: 16 }}>
                By continuing you agree to the Terms of Service and Privacy Policy.
              </AppText>
            </>
          ) : (
            <>
              <AppView gap={6}>
                <AppText family="heading" weight="bold" style={{ fontSize: 22, lineHeight: 28, color: tokens.text }}>
                  Enter the code
                </AppText>
                <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
                  We sent a 6-digit code to {phone.trim()}.
                </AppText>
              </AppView>

              <AppTextField
                testID="auth-otp-field"
                label="Verification code"
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
                title={isLoading ? 'Verifying…' : 'Verify & continue'}
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
                accessibilityLabel="Resend code"
              >
                <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
                  Didn’t get it? Resend code
                </AppText>
              </AppPressableView>
            </>
          )}
        </AppView>
      </KeyboardAvoidingView>
    </AppView>
  );
}
