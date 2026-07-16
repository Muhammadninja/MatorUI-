import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/shared/app-logo';
import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import type { OtpChannel } from '@/services/auth-api';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptics';

export type PasswordlessAuthMode = 'sign-in' | 'sign-up';

/**
 * Passwordless auth — phone (default) or email + a one-time code, used by both
 * Sign In and Sign Up. A single screen with two phases (enter identifier → enter
 * code) so the `?gate=1` purchase gate keeps working: on success we `router.back()`
 * to wherever the gate fired (item detail / cart), exactly as before.
 *
 * DEMO/E2E: the mock `requestOtp` returns a `devCode`, which we auto-fill into the
 * code field so the offline suite stays buttons-only. A real backend omits it and
 * the user types the code they receive. The phone field is likewise pre-filled with
 * a demo number in this mock build — remove both once the real backend is wired.
 */
export default function PasswordlessAuthScreen({ mode }: { mode: PasswordlessAuthMode }) {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { requestOtp, verifyOtp, isLoading } = useUserContext();
  const { gate } = useLocalSearchParams<{ gate?: string }>();
  const gated = gate === '1';
  const isSignUp = mode === 'sign-up';

  const [phase, setPhase] = useState<'entry' | 'otp'>('entry');
  const [channel, setChannel] = useState<OtpChannel>('phone'); // phone is the default
  const [name, setName] = useState('');
  // DEMO prefill (see file header) — a valid-looking UZ number so the E2E flow
  // can send without typing. Clear this for the real backend build.
  const [phone, setPhone] = useState('+998 90 123 45 67');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);

  const field = {
    containerRounded: 12 as const,
    containerColorName: 'backgroundSecondary' as const,
    containerBorderName: 'border' as const,
  };

  const identifier = channel === 'phone' ? phone.trim() : email.trim();

  const handleBack = () => {
    triggerHaptic('selection');
    if (phase === 'otp') {
      setPhase('entry');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
  };

  const finish = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
  };

  const nameParts = () => {
    const trimmed = name.trim();
    const sep = trimmed.indexOf(' ');
    return sep === -1
      ? { firstName: trimmed, lastName: '' }
      : { firstName: trimmed.slice(0, sep), lastName: trimmed.slice(sep + 1).trim() };
  };

  const sendCode = async () => {
    if (isLoading) return;
    if (isSignUp && name.trim().length < 2) {
      triggerHaptic('error');
      toast.danger('Tell us your name first');
      return;
    }
    if (!identifier) {
      triggerHaptic('error');
      toast.danger(channel === 'phone' ? 'Enter your phone number' : 'Enter your email');
      return;
    }
    try {
      const { otpToken: token, devCode } = await requestOtp({
        channel,
        identifier,
        purpose: mode,
        ...(isSignUp ? nameParts() : {}),
      });
      triggerHaptic('success');
      setOtpToken(token);
      // DEMO/E2E: auto-fill the code the mock handed back. Real backends omit it.
      setCode(devCode ?? '');
      setPhase('otp');
      toast.info(`Code sent to ${identifier}`);
    } catch (err) {
      triggerHaptic('error');
      toast.danger('Could not send the code', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const verify = async () => {
    if (isLoading || !otpToken) return;
    try {
      await verifyOtp({ otpToken, code: code.trim() });
      triggerHaptic('success');
      finish();
    } catch (err) {
      triggerHaptic('error');
      toast.danger('That code did not work', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const resend = async () => {
    if (isLoading) return;
    try {
      const { otpToken: token, devCode } = await requestOtp({
        channel,
        identifier,
        purpose: mode,
        ...(isSignUp ? nameParts() : {}),
      });
      setOtpToken(token);
      setCode(devCode ?? '');
      toast.info('New code sent');
    } catch {
      toast.danger('Could not resend the code');
    }
  };

  return (
    <AppView flex={1} colorName="background" testID={`${mode}-screen`}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
        >
          {gated || phase === 'otp' ? (
            <AppPressableView
              onPress={handleBack}
              center
              rounded={12}
              borderWidth={1}
              borderName="border"
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={{ width: 40, height: 40, marginBottom: 20 }}
            >
              <ArrowLeft size={22} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
          ) : (
            <AppView style={{ marginBottom: 36 }}>
              <AppLogo size={26} />
            </AppView>
          )}

          {phase === 'entry' ? (
            <EntryPhase
              mode={mode}
              gated={gated}
              channel={channel}
              onChannel={setChannel}
              name={name}
              onName={setName}
              phone={phone}
              onPhone={setPhone}
              email={email}
              onEmail={setEmail}
              field={field}
              isLoading={isLoading}
              onSend={sendCode}
            />
          ) : (
            <OtpPhase
              identifier={identifier}
              code={code}
              onCode={setCode}
              field={field}
              isLoading={isLoading}
              onVerify={verify}
              onResend={resend}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppView>
  );
}

function EntryPhase({
  mode,
  gated,
  channel,
  onChannel,
  name,
  onName,
  phone,
  onPhone,
  email,
  onEmail,
  field,
  isLoading,
  onSend,
}: {
  mode: PasswordlessAuthMode;
  gated: boolean;
  channel: OtpChannel;
  onChannel: (c: OtpChannel) => void;
  name: string;
  onName: (v: string) => void;
  phone: string;
  onPhone: (v: string) => void;
  email: string;
  onEmail: (v: string) => void;
  field: Record<string, unknown>;
  isLoading: boolean;
  onSend: () => void;
}) {
  const { tokens } = useThemeContext();
  const isSignUp = mode === 'sign-up';

  return (
    <>
      <AppText family="heading" weight="bold" style={{ fontSize: 28, lineHeight: 34, color: tokens.text }}>
        {isSignUp ? 'Create account' : 'Welcome back'}
      </AppText>
      <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, marginTop: 8, marginBottom: 24 }}>
        {gated
          ? 'Sign in to add parts and check out.'
          : channel === 'phone'
            ? 'We’ll text you a code to sign in — no password needed.'
            : 'We’ll email you a code to sign in — no password needed.'}
      </AppText>

      <AppView gap={16} style={{ flex: 1 }}>
        {isSignUp ? (
          <AppTextField label="Full name" placeholder="Alex Marino" value={name} onChangeText={onName} autoCapitalize="words" {...field} />
        ) : null}

        <ChannelToggle channel={channel} onChannel={onChannel} />

        {channel === 'phone' ? (
          <AppTextField
            testID="auth-phone-field"
            label="Phone number"
            placeholder="+998 90 123 45 67"
            value={phone}
            onChangeText={onPhone}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="phone-pad"
            {...field}
          />
        ) : (
          <AppTextField
            testID="auth-email-field"
            label="Email"
            placeholder="you@email.com"
            value={email}
            onChangeText={onEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            {...field}
          />
        )}
      </AppView>

      <AppView gap={14} style={{ marginTop: 20 }}>
        <AppText family="default" style={{ fontSize: 11, color: tokens.textMuted, textAlign: 'center', lineHeight: 16 }}>
          By continuing you agree to the Terms of Service and Privacy Policy.
        </AppText>
        <AppButton
          testID="auth-send-code-btn"
          title={isLoading ? 'Sending code…' : 'Send code'}
          kind="brand"
          size="lg"
          fullWidth
          disabled={isLoading}
          onPress={onSend}
        />
        <AppView row justify="center" align="center" gap={6}>
          <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
            {isSignUp ? 'Already have an account?' : 'New to Mator?'}
          </AppText>
          <AppPressableView
            onPress={() => router.replace(isSignUp ? '/sign-in' : '/sign-up')}
            accessibilityRole="button"
            accessibilityLabel={isSignUp ? 'Log in' : 'Create account'}
          >
            <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.text }}>
              {isSignUp ? 'Log in' : 'Create account'}
            </AppText>
          </AppPressableView>
        </AppView>
      </AppView>
    </>
  );
}

function OtpPhase({
  identifier,
  code,
  onCode,
  field,
  isLoading,
  onVerify,
  onResend,
}: {
  identifier: string;
  code: string;
  onCode: (v: string) => void;
  field: Record<string, unknown>;
  isLoading: boolean;
  onVerify: () => void;
  onResend: () => void;
}) {
  const { tokens } = useThemeContext();

  return (
    <>
      <AppText family="heading" weight="bold" style={{ fontSize: 28, lineHeight: 34, color: tokens.text }}>
        Enter the code
      </AppText>
      <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, marginTop: 8, marginBottom: 24 }}>
        We sent a 6-digit code to {identifier}.
      </AppText>

      <AppView gap={16} style={{ flex: 1 }}>
        <AppTextField
          testID="auth-otp-field"
          label="Verification code"
          placeholder="123456"
          value={code}
          onChangeText={(v: string) => onCode(v.replace(/\D/g, '').slice(0, 6))}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          {...field}
        />
        <AppPressableView
          onPress={onResend}
          disabled={isLoading}
          style={{ alignSelf: 'flex-start' }}
          accessibilityRole="button"
          accessibilityLabel="Resend code"
        >
          <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
            Didn’t get it? Resend code
          </AppText>
        </AppPressableView>
      </AppView>

      <AppView gap={14} style={{ marginTop: 20 }}>
        <AppButton
          testID="auth-verify-btn"
          title={isLoading ? 'Verifying…' : 'Verify & continue'}
          kind="brand"
          size="lg"
          fullWidth
          disabled={isLoading || code.length < 6}
          onPress={onVerify}
        />
      </AppView>
    </>
  );
}

function ChannelToggle({
  channel,
  onChannel,
}: {
  channel: OtpChannel;
  onChannel: (c: OtpChannel) => void;
}) {
  const { tokens } = useThemeContext();
  const options: { key: OtpChannel; label: string }[] = [
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
  ];
  return (
    <AppView
      row
      gap={4}
      rounded={12}
      p={4}
      colorName="backgroundSecondary"
      borderWidth={1}
      borderName="border"
    >
      {options.map((opt) => {
        const selected = opt.key === channel;
        return (
          <AppPressableView
            key={opt.key}
            testID={`auth-channel-${opt.key}`}
            onPress={() => {
              triggerHaptic('selection');
              onChannel(opt.key);
            }}
            center
            rounded={9}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              paddingVertical: 10,
              backgroundColor: selected ? tokens.brand : 'transparent',
            }}
          >
            <AppText
              family="accent"
              weight="semibold"
              style={{ fontSize: 14, color: selected ? tokens.onBrand : tokens.textMuted }}
            >
              {opt.label}
            </AppText>
          </AppPressableView>
        );
      })}
    </AppView>
  );
}
