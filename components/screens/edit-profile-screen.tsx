import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import AppTextField from '@/components/shared/app-text-field';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/contexts/user.context';

/** Initials monogram from first + last name, e.g. "AM". Falls back to "M". */
function initials(name: string): string {
  const derived = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return derived || 'M';
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const { tokens } = useThemeContext();
  const toast = useToast();
  const { profile, updateProfile } = useUserContext();

  const [fullName, setFullName] = useState(
    `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim(),
  );
  const [email, setEmail]       = useState(profile?.email ?? '');
  const [phone, setPhone]       = useState(profile?.phone ?? '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(
    profile?.avatarUrl ?? undefined,
  );
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.info('Photo access is needed to change your picture');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSave = Boolean(fullName.trim() && emailValid) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    // UserSummary carries firstName + lastName; the form is a single field, so
    // split on the first space — first token is the given name, the rest is the
    // family name.
    const trimmedName = fullName.trim();
    const spaceIdx = trimmedName.indexOf(' ');
    const firstName = spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
    const lastName = spaceIdx === -1 ? '' : trimmedName.slice(spaceIdx + 1).trim();

    setSaving(true);
    try {
      await updateProfile({
        firstName,
        lastName,
        email: email.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUri ?? null,
      });
      toast.success('Profile updated');
      router.back();
    } catch {
      toast.danger('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Edit profile" fallbackHref="/profile" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <AppView gap={28}>
            {/* Centered 92px avatar with brand edit-badge */}
            <AppView align="center" style={{ marginBottom: 4 }}>
              <AppView style={{ position: 'relative' }}>
                {/* Avatar */}
                <AppView
                  center
                  rounded={999}
                  style={{
                    width: 92,
                    height: 92,
                    overflow: 'hidden',
                    backgroundColor: tokens.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  }}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={{ width: 92, height: 92 }} />
                  ) : (
                    <AppText
                      family="heading"
                      weight="bold"
                      style={{ fontSize: 30, lineHeight: 36, color: tokens.text }}
                    >
                      {initials(fullName)}
                    </AppText>
                  )}
                </AppView>

                {/* Brand edit-badge */}
                <Pressable
                  onPress={pickPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: tokens.brandBg,
                    borderWidth: 3,
                    borderColor: tokens.background,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <AppText style={{ fontSize: 13, color: tokens.onBrand }}>✎</AppText>
                </Pressable>
              </AppView>
            </AppView>

            {/* Form fields */}
            <AppView px="lg" gap="lg">
              <AppTextField
                label="Full name"
                placeholder="Enter your full name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <AppTextField
                label="Email"
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <AppTextField
                label="Phone"
                placeholder="+1 (000) 000-0000"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
            </AppView>

            {/* Save CTA */}
            <AppView px="lg" style={{ marginTop: 8 }}>
              <AppButton
                title="Save changes"
                kind="brand"
                size="lg"
                fullWidth
                disabled={!canSave}
                onPress={handleSave}
              />
            </AppView>
          </AppView>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppView>
  );
}
