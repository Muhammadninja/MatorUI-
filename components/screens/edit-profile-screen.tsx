import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
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
import { uploadAvatar } from '@/services/avatar-service';
import { debugLog } from '@/services/debug-log';
import { PhoneChangeSheet } from '@/components/screens-components/account/phone-change-sheet';

/** A picked image is a local file:// / ph:// / content:// URI that the backend
 *  can't store — those must be uploaded first. An https URL is already hosted. */
function isLocalImageUri(uri: string): boolean {
  return !/^https?:\/\//i.test(uri);
}

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
  // Email is read-only (no backend field). Phone IS changeable now — via the
  // dedicated OTP flow (POST /v1/me/phone/request + confirm), opened as a sheet;
  // it re-binds the login identity and swaps the session, so it can't ride the
  // plain name/avatar PATCH.
  const [email] = useState(profile?.email ?? '');
  const [phoneSheetVisible, setPhoneSheetVisible] = useState(false);
  // Seed from the backend avatar so reopening shows the current picture.
  const [avatarUri, setAvatarUri] = useState<string | undefined>(
    profile?.avatarUrl ?? undefined,
  );
  // Fall back to initials when the avatar image can't load (e.g. a dead/removed
  // Cloudinary URL). Reset on a new pick so a fresh photo gets a chance to show.
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => setAvatarFailed(false), [avatarUri]);
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

  // Only the full name (and avatar) are editable, so that's all the Save gate
  // needs. Requiring a valid email here used to permanently disable Save for
  // phone-signup users (who have no email) — they could never update their name.
  const canSave = Boolean(fullName.trim()) && !saving;

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
      // A freshly-picked photo is a local file:// URI the backend can't store —
      // upload it first and persist the returned HTTPS URL. An existing https
      // avatar (or no avatar) is passed through untouched. A freshly-picked photo
      // is a local file:// URI — upload it (POST /v1/me/avatar, live) to get an
      // HTTPS URL. If the upload fails, keep the existing avatar and still save
      // the name (don't block the whole edit), warning the user about the photo.
      let avatarUrl: string | null = avatarUri ?? null;
      let photoFailed = false;
      if (avatarUri && isLocalImageUri(avatarUri)) {
        try {
          avatarUrl = await uploadAvatar(avatarUri);
        } catch (err) {
          debugLog('profile', 'avatar upload failed — saving without new photo', {
            message: (err as Error)?.message,
          });
          avatarUrl = profile?.avatarUrl ?? null; // leave the backend avatar untouched
          photoFailed = true;
        }
      }

      // Phone is the login identity (changed via the OTP flow, not here) and
      // email has no backend field, so neither is sent.
      await updateProfile({
        firstName,
        lastName,
        avatarUrl,
      });
      if (photoFailed) {
        toast.info('Saved, but the photo couldn’t be uploaded. Try again.');
      } else {
        toast.success('Profile updated');
      }
      router.back();
    } catch (err) {
      debugLog('profile', 'handleSave FAILED', { message: (err as Error)?.message });
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
                  {avatarUri && !avatarFailed ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={{ width: 92, height: 92 }}
                      onError={() => setAvatarFailed(true)}
                    />
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
                placeholder="Not linked"
                value={email}
                disabled
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <AppTextField
                label="Phone"
                placeholder="+998 90 123 45 67"
                value={profile?.phone ?? ''}
                disabled
                keyboardType="phone-pad"
                autoCorrect={false}
              />
              <Pressable
                onPress={() => setPhoneSheetVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Change phone number"
                style={{ marginTop: -6 }}
              >
                <AppText
                  family="accent"
                  weight="bold"
                  colorName="brandBg"
                  style={{ fontSize: 13 }}
                >
                  Change phone number
                </AppText>
              </Pressable>
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

      <PhoneChangeSheet
        visible={phoneSheetVisible}
        onClose={() => setPhoneSheetVisible(false)}
        currentPhone={profile?.phone ?? null}
      />
    </AppView>
  );
}
