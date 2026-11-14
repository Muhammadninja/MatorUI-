/**
 * Staging builds only: asks the tester for their personal staging access token
 * before the app talks to api.staging.mator.uz, and again whenever the proxy
 * refuses the saved one (revoked). Renders nothing in any other build.
 * Tester tooling, so the copy is English only.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import {
  hasStagingAccess,
  isStagingBuild,
  isValidStagingAccessToken,
  saveStagingAccess,
  subscribeStagingAccess,
  verifyStagingAccess,
} from '@/services/staging-access';

const MESSAGES = {
  denied: 'The staging server refused this token. Check it, or ask for a new one.',
  unreachable: 'Could not reach the staging server. Check the connection and try again.',
  shape: 'A token is 32 to 128 letters, digits, "-" or "_".',
  storage: 'Could not save the token on this device.',
} as const;

export function StagingAccessGate() {
  const insets = useSafeAreaInsets();
  const { tokens } = useThemeContext();
  const allowed = useSyncExternalStore(subscribeStagingAccess, hasStagingAccess, hasStagingAccess);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof MESSAGES | null>(null);

  useEffect(() => { if (allowed) setValue(''); }, [allowed]);

  if (!isStagingBuild() || allowed) return null;

  const submit = async () => {
    const candidate = value.trim();
    if (!isValidStagingAccessToken(candidate)) { setError('shape'); return; }
    setBusy(true);
    setError(null);
    try {
      const check = await verifyStagingAccess(candidate);
      if (check !== 'ok') { setError(check); return; }
      await saveStagingAccess(candidate);
    } catch {
      setError('storage');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppView
      testID="staging-access-gate"
      style={[StyleSheet.absoluteFill, { zIndex: 2000, backgroundColor: tokens.background,
        paddingTop: insets.top + 48, paddingHorizontal: 24, gap: 16 }]}
    >
      <AppText fontSize={24} weight="bold" style={{ color: tokens.text }}>Mator Staging</AppText>
      <AppText style={{ color: tokens.textMuted }}>
        This test build talks to the staging server only. Enter your personal staging access token.
        It is stored on this device and never shared with the production app.
      </AppText>
      <TextInput
        testID="staging-access-input"
        value={value}
        onChangeText={(text) => { setValue(text); setError(null); }}
        placeholder="Staging access token"
        placeholderTextColor={tokens.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        editable={!busy}
        onSubmitEditing={submit}
        style={{ color: tokens.text, borderColor: error ? tokens.error : tokens.border, borderWidth: 1,
          borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 }}
      />
      {error ? (
        <AppText testID="staging-access-error" style={{ color: tokens.error }}>{MESSAGES[error]}</AppText>
      ) : null}
      <AppButton testID="staging-access-submit" title="Continue" onPress={submit} loading={busy}
        disabled={busy || value.trim().length === 0} />
    </AppView>
  );
}
