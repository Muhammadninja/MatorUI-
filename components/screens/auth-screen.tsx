import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useMemo, useState } from 'react';

import AppBlurView, { useBlurHeaderInset } from '@/components/shared/app-blur-view';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import AppTextField from '@/components/shared/app-text-field';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import AppKeyboardController from '@/components/shared/keyboard-controller/app-keyboard-controller';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptics';

const HEADER_HEIGHT = 56;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthMode = 'login' | 'signup';

export type AuthScreenProps = {
  mode: AuthMode;
};

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'confirm', string>>;

export default function AuthScreen({ mode }: AuthScreenProps) {
  const { tokens, scheme } = useThemeContext();
  const { signInWithMock } = useUserContext();
  const toast = useToast();
  // peek=0 so the first content row sits flush below the header instead of
  // scrolling underneath — this screen is short and doesn't need the peek effect.
  const topInset = useBlurHeaderInset(HEADER_HEIGHT, 0);
  const params = useLocalSearchParams<{ next?: string }>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';
  const passwordStrength = useMemo(() => scorePassword(password), [password]);

  const handleClose = () => {
    triggerHaptic('selection');
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (isSignup && name.trim().length < 2) {
      next.name = 'Tell us what to call you.';
    }
    if (!EMAIL_RE.test(email.trim())) {
      next.email = 'Enter a valid email.';
    }
    if (password.length < (isSignup ? 8 : 1)) {
      next.password = isSignup ? 'At least 8 characters.' : 'Enter your password.';
    }
    if (isSignup && confirm !== password) {
      next.confirm = 'Passwords do not match.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (submitting) return;
    if (!validate()) {
      triggerHaptic('error');
      return;
    }
    triggerHaptic('selection');
    setSubmitting(true);
    setTimeout(() => {
      signInWithMock();
      triggerHaptic('success');
      toast.success(isSignup ? 'Welcome aboard' : 'Welcome back');
      setSubmitting(false);
      const next = params.next;
      if (typeof next === 'string' && next.startsWith('/')) {
        router.replace(next as never);
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/explore');
      }
    }, 900);
  };

  const handleSocial = (provider: 'apple' | 'google') => {
    triggerHaptic('selection');
    toast.info(`${provider === 'apple' ? 'Apple' : 'Google'} sign-in placeholder`);
  };

  const handleForgot = () => {
    triggerHaptic('selection');
    toast.info('Password reset', {
      description: 'Reset email will fire once the auth backend lands.',
    });
  };

  const switchMode = () => {
    triggerHaptic('selection');
    const target = isSignup ? '/sign-in' : '/sign-up';
    const query = params.next ? `?next=${encodeURIComponent(params.next)}` : '';
    router.replace(`${target}${query}` as never);
  };

  return (
    <AppView flex={1} colorName="background">
      <AppKeyboardController
        showToolbar={false}
        offset={isSignup ? 220 : 140}
        horizontalPadding={20}
        fillContainer
        kStyle={{
          paddingTop: topInset + 8,
          paddingBottom: 24,
          gap: isSignup ? 12 : 18,
        }}
      >
        {/* Title — compact on signup so the form fits on one screen */}
        <AppView gap={isSignup ? 4 : 8} mt={isSignup ? 4 : 18}>
          <AppText
            textVariant={isSignup ? 'h4' : 'title'}
            family="heading"
            weight="bold"
          >
            {isSignup ? 'Create your account' : 'Welcome back'}
          </AppText>
          {!isSignup ? (
            <AppText textVariant="bodySm" colorName="gray400">
              Log in to pick up where you left off.
            </AppText>
          ) : null}
        </AppView>

        {/* Social — side-by-side on signup to save vertical space */}
        {isSignup ? (
          <AppView row gap={8}>
            <SocialButton label="Apple" glyph="" compact onPress={() => handleSocial('apple')} />
            <SocialButton label="Google" glyph="G" compact onPress={() => handleSocial('google')} />
          </AppView>
        ) : (
          <AppView gap={10}>
            <SocialButton
              label="Continue with Apple"
              glyph=""
              onPress={() => handleSocial('apple')}
            />
            <SocialButton
              label="Continue with Google"
              glyph="G"
              onPress={() => handleSocial('google')}
            />
          </AppView>
        )}

        <AppView row align="center" gap={10}>
          <AppView style={{ flex: 1, height: 1, backgroundColor: tokens.divider }} />
          <AppText textVariant="bodyXs" colorName="gray400">
            or with email
          </AppText>
          <AppView style={{ flex: 1, height: 1, backgroundColor: tokens.divider }} />
        </AppView>

        {/* Form */}
        <AppView gap={isSignup ? 8 : 12}>
          {isSignup ? (
            <AppTextField
              label="Name"
              placeholder="Your name"
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
              }}
              errorText={errors.name}
              autoCapitalize="words"
              autoCorrect={false}
              containerColorName="card"
              containerBorderName="border"
            />
          ) : null}

          <AppTextField
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
            errorText={errors.email}
            autoCapitalize="none"
            autoCorrect={false}
            containerColorName="card"
            containerBorderName="border"
          />

          <AppTextField
            label="Password"
            placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            errorText={errors.password}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showPassword}
            containerColorName="card"
            containerBorderName="border"
            rightAdornment={
              <AppPressableView
                onPress={() => setShowPassword((s) => !s)}
                androidRipple={false}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={{ paddingHorizontal: 4, paddingVertical: 4 }}
              >
                {showPassword ? (
                  <EyeOff size={16} strokeWidth={2.2} color={tokens.gray400} />
                ) : (
                  <Eye size={16} strokeWidth={2.2} color={tokens.gray400} />
                )}
              </AppPressableView>
            }
          />

          {isSignup && password.length > 0 ? (
            <PasswordStrength strength={passwordStrength} compact />
          ) : null}

          {isSignup ? (
            <AppTextField
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined }));
              }}
              errorText={errors.confirm}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPassword}
              containerColorName="card"
              containerBorderName="border"
            />
          ) : null}

          {!isSignup ? (
            <AppView align="flex-end">
              <AppPressableView onPress={handleForgot} androidRipple={false}>
                <AppText
                  textVariant="bodyXs"
                  weight="semibold"
                  style={{ textDecorationLine: 'underline', color: tokens.text }}
                >
                  Forgot password?
                </AppText>
              </AppPressableView>
            </AppView>
          ) : null}
        </AppView>

        <AppButton
          title={
            submitting
              ? isSignup
                ? 'Creating account…'
                : 'Signing in…'
              : isSignup
                ? 'Create account'
                : 'Log in'
          }
          kind="brand"
          size="md"
          fullWidth
          disabled={submitting}
          onPress={handleSubmit}
        />

        {isSignup ? null : (
          <AppView style={{ height: 1, backgroundColor: tokens.divider }} />
        )}

        <AppView row align="center" justify="center" gap={6}>
          <AppText textVariant="bodySm" colorName="gray400">
            {isSignup ? 'Already have an account?' : 'New here?'}
          </AppText>
          <AppPressableView onPress={switchMode} androidRipple={false}>
            <AppText textVariant="bodySm" weight="semibold">
              {isSignup ? 'Log in' : 'Create account'}
            </AppText>
          </AppPressableView>
        </AppView>
      </AppKeyboardController>

      <AppBlurView contentHeight={HEADER_HEIGHT}>
        <AppView row align="center" justify="space-between" px={16} pt={8} pb={12}>
          <AppPressableView
            center
            rounded={36}
            onPress={handleClose}
            androidRipple
            accessibilityLabel="Close"
            style={{
              width: 36,
              height: 36,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            }}
          >
            <ArrowLeft size={18} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
          <AppText textVariant="bodySm" weight="semibold">
            {isSignup ? 'Sign up' : 'Log in'}
          </AppText>
          <AppView style={{ width: 36 }} />
        </AppView>
      </AppBlurView>
    </AppView>
  );
}

function SocialButton({
  label,
  glyph,
  compact,
  onPress,
}: {
  label: string;
  glyph: string;
  compact?: boolean;
  onPress: () => void;
}) {
  const { tokens, scheme } = useThemeContext();
  return (
    <AppPressableView
      onPress={onPress}
      androidRipple
      style={{
        flex: compact ? 1 : undefined,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.border,
        paddingVertical: compact ? 10 : 14,
        backgroundColor: scheme === 'dark' ? tokens.gray200 : tokens.gray100,
      }}
    >
      <AppView row align="center" justify="center" gap={8}>
        {glyph ? (
          <AppText weight="bold" style={{ color: tokens.text }}>
            {glyph}
          </AppText>
        ) : null}
        <AppText weight="semibold" style={{ color: tokens.text }}>
          {label}
        </AppText>
      </AppView>
    </AppPressableView>
  );
}

function PasswordStrength({
  strength,
  compact,
}: {
  strength: { score: 0 | 1 | 2 | 3 | 4; label: string };
  compact?: boolean;
}) {
  const { tokens } = useThemeContext();
  const colors = [tokens.error, tokens.error, tokens.secondary, tokens.success, tokens.success];
  const color = colors[strength.score];

  // Compact form: bar + label on the same line so it doesn't add a row of vertical space.
  if (compact) {
    return (
      <AppView row align="center" gap={10}>
        <AppView row gap={3} style={{ flex: 1 }}>
          {[0, 1, 2, 3].map((i) => (
            <AppView
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 36,
                backgroundColor: i < strength.score ? color : tokens.divider,
              }}
            />
          ))}
        </AppView>
        <AppText textVariant="bodyXs" style={{ color, minWidth: 48, textAlign: 'right' }}>
          {strength.label}
        </AppText>
      </AppView>
    );
  }

  return (
    <AppView gap={6}>
      <AppView row gap={4}>
        {[0, 1, 2, 3].map((i) => (
          <AppView
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 36,
              backgroundColor: i < strength.score ? color : tokens.divider,
            }}
          />
        ))}
      </AppView>
      <AppText textVariant="bodyXs" style={{ color }}>
        {strength.label}
      </AppText>
    </AppView>
  );
}

function scorePassword(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: 'Too short' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}
