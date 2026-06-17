import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';

import AppImage from '@/components/shared/app-image';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import AppTextField from '@/components/shared/app-text-field';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { uploadAvatar } from '@/services/avatar-service';
import { toastService } from '@/services/toast-service';
import { triggerHaptic } from '@/utils/haptics';

export default function EditProfileScreen() {
  const { tokens } = useThemeContext();
  const { profile, updateProfile } = useUserContext();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);

  // A profile must always carry a non-empty first name, so saving is gated
  // on a non-blank (trimmed) first name. Beyond that, only allow saving when
  // *something* actually changed — name edits or a freshly-picked avatar —
  // so the user can't "save" a form that matches the persisted state.
  const hasChanges =
    firstName.trim().length > 0 ||
    lastName.trim().length > 0 ||
    avatarUrl !== (profile?.avatarUrl ?? null);
  const canSave = firstName.trim().length > 0 && hasChanges;

  // Abort an in-flight upload if the user navigates away mid-upload —
  // otherwise the response would land into a stale component.
  useEffect(() => () => uploadAbortRef.current?.abort(), []);

  const pickAvatar = async () => {
    triggerHaptic('selection');
    const perms = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perms.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo access to update your profile picture.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const localUri = result.assets[0].uri;
    // Optimistic preview — show the picked image instantly even though
    // the upload is still pending. If the upload fails we roll back.
    const previousUrl = avatarUrl;
    setAvatarUrl(localUri);
    setUploadingAvatar(true);

    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      const remoteUrl = await uploadAvatar(localUri, controller.signal);
      setAvatarUrl(remoteUrl);
    } catch (err) {
      if (controller.signal.aborted) return;
      setAvatarUrl(previousUrl);
      Alert.alert('Upload failed', 'Could not upload your photo. Please try again.');
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null;
        setUploadingAvatar(false);
      }
    }
  };

  const handleSave = async () => {
    if (saving || !canSave) return;
    triggerHaptic('selection');
    setSaving(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarUrl,
      });
      triggerHaptic('success');
      router.back();
    } catch {
      // Surface the failure instead of swallowing the rejection, and stay on
      // the screen so the user can retry without losing their edits.
      triggerHaptic('error');
      toastService.danger('Could not save profile', {
        description: 'Please check your connection and try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const initials =
    `${profile?.firstName?.[0] ?? ''}${profile?.lastName?.[0] ?? ''}`.toUpperCase() || 'YOU';

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title="Edit Profile"
        fallbackHref="/profile"
        right={
          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.brand,
              opacity: !canSave || saving ? 0.4 : pressed ? 0.85 : 1,
            })}
          >
            <Check size={16} strokeWidth={2.4} color={tokens.onBrand} />
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <AppView gap={28}>
            {/* Avatar */}
            <AppView align="center" gap={10}>
              <AppView style={{ position: 'relative' }}>
                <AppView
                  center
                  rounded={999}
                  style={{
                    width: 100,
                    height: 100,
                    backgroundColor: tokens.backgroundSecondary,
                    borderWidth: 3,
                    borderColor: tokens.border,
                    overflow: 'hidden',
                  }}
                >
                  {avatarUrl ? (
                    <AppImage
                      source={{ uri: avatarUrl }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <AppText
                      textVariant="title"
                      family="heading"
                      weight="bold"
                      colorName="text"
                    >
                      {initials}
                    </AppText>
                  )}
                </AppView>

                <Pressable
                  onPress={pickAvatar}
                  disabled={uploadingAvatar}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: tokens.brand,
                    borderWidth: 2,
                    borderColor: tokens.background,
                    opacity: uploadingAvatar ? 0.6 : pressed ? 0.75 : 1,
                  })}
                >
                  <Camera size={15} strokeWidth={2.1} color={tokens.onBrand} />
                </Pressable>
              </AppView>

              <AppText textVariant="bodyXs" colorName="gray400">
                {uploadingAvatar ? 'Uploading…' : 'Tap camera to update photo'}
              </AppText>
            </AppView>

            {/* Form */}
            <AppView px="lg" gap="lg">
              <AppTextField
                label="First Name"
                placeholder="Enter first name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <AppTextField
                label="Last Name"
                placeholder="Enter last name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </AppView>

            <AppView px="lg">
              <AppButton
                title={saving ? 'Saving…' : 'Save Changes'}
                kind="brand"
                size="lg"
                fullWidth
                disabled={!canSave || saving}
                onPress={handleSave}
              />
            </AppView>
          </AppView>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppView>
  );
}
