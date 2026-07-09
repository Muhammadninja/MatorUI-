import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Sign Up — faithful rebuild of the prototype's `scSignUp`, now wired to the
 * real `useUserContext().signUp`. "Create account" splits the full name into
 * first/last and registers through the auth transport; on success we go back
 * (or to Explore). Button shows the in-flight state; errors surface as a toast.
 */
export default function MatorSignUpScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { signUp, isLoading } = useUserContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  const handleCreate = async () => {
    if (isLoading) return;
    // Split "Full Name" into first / last on the first whitespace.
    const trimmed = name.trim();
    const sep = trimmed.indexOf(' ');
    const firstName = sep === -1 ? trimmed : trimmed.slice(0, sep);
    const lastName = sep === -1 ? '' : trimmed.slice(sep + 1).trim();
    try {
      await signUp({ email: email.trim(), password, firstName, lastName });
      triggerHaptic('success');
      if (router.canGoBack()) router.back();
      else router.replace('/explore');
    } catch (err) {
      triggerHaptic('error');
      toast.danger('Could not create your account', {
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

          <AppText family="heading" weight="bold" style={{ fontSize: 28, lineHeight: 34, color: tokens.text }}>
            Create account
          </AppText>
          <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, marginTop: 8, marginBottom: 24 }}>
            Parts that fit, guaranteed by VIN.
          </AppText>

          <AppView gap={16} style={{ flex: 1 }}>
            <AppTextField label="Full name" placeholder="Alex Marino" value={name} onChangeText={setName} autoCapitalize="words" {...field} />
            <AppTextField label="Email" placeholder="you@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" {...field} />
            <AppTextField label="Password" placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry {...field} />
          </AppView>

          <AppView gap={14} style={{ marginTop: 20 }}>
            <AppText family="default" style={{ fontSize: 11, color: tokens.textMuted, textAlign: 'center', lineHeight: 16 }}>
              By continuing you agree to the Terms of Service and Privacy Policy.
            </AppText>
            <AppButton title={isLoading ? 'Creating account…' : 'Create account'} kind="brand" size="lg" fullWidth disabled={isLoading} onPress={handleCreate} />
          </AppView>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppView>
  );
}
