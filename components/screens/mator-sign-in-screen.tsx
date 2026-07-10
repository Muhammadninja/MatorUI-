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
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Sign In — faithful rebuild of the prototype's `scSignIn`, now wired to the
 * real `useUserContext().signIn`. Reached via the purchase gate (`?gate=1`,
 * shows a back button + buy copy) or from Profile. On success we go back to
 * where the user came from (or Explore); the button shows the in-flight state
 * and errors surface as a toast.
 */
export default function MatorSignInScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { signIn, isLoading } = useUserContext();
  const { gate } = useLocalSearchParams<{ gate?: string }>();
  const gated = gate === '1';

  const [email, setEmail] = useState('alex.marino@email.com');
  const [password, setPassword] = useState('demo1234');

  const field = {
    containerRounded: 12 as const,
    containerColorName: 'backgroundSecondary' as const,
    containerBorderName: 'border' as const,
  };

  const handleClose = () => {
    triggerHaptic('selection');
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
  };

  const handleSignIn = async () => {
    if (isLoading) return;
    try {
      await signIn({ email: email.trim(), password });
      triggerHaptic('success');
      if (router.canGoBack()) router.back();
      else router.replace('/explore');
    } catch (err) {
      triggerHaptic('error');
      toast.danger('Could not sign you in', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <AppView flex={1} colorName="background">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
        >
          {gated ? (
            <AppPressableView
              onPress={handleClose}
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

          <AppText family="heading" weight="bold" style={{ fontSize: 28, lineHeight: 34, color: tokens.text }}>
            Welcome back
          </AppText>
          <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, marginTop: 8, marginBottom: 28 }}>
            {gated ? 'Sign in to add parts and check out.' : 'Sign in to keep your garage and orders in sync.'}
          </AppText>

          <AppView gap={16} style={{ flex: 1 }}>
            <AppTextField label="Email or phone" placeholder="you@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" {...field} />
            <AppTextField label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry {...field} />
            <AppPressableView onPress={() => toast.info('Reset link sent')} style={{ alignSelf: 'flex-end' }} accessibilityRole="button" accessibilityLabel="Forgot password">
              <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
                Forgot password?
              </AppText>
            </AppPressableView>
          </AppView>

          <AppView gap={14} style={{ marginTop: 20 }}>
            <AppButton title={isLoading ? 'Signing in…' : 'Sign in'} kind="brand" size="lg" fullWidth disabled={isLoading} onPress={handleSignIn} />
            <AppView row justify="center" align="center" gap={6}>
              <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>New to Mator?</AppText>
              <AppPressableView
                onPress={() => router.push(gated ? '/sign-up?gate=1' : '/sign-up')}
                accessibilityRole="button"
                accessibilityLabel="Create account"
              >
                <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.text }}>Create account</AppText>
              </AppPressableView>
            </AppView>
          </AppView>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppView>
  );
}
