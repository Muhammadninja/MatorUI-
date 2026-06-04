import { router } from 'expo-router';
import { ArrowLeft, Camera, Check } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import ScreenShell from '@/components/screens-components/screen-shell';
import { AppText } from '@/components/shared/app-text';
import AppTextField from '@/components/shared/app-text-field';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';

export default function EditProfileScreen() {
  const { tokens } = useThemeContext();
  const { profile, updateProfile } = useUserContext();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [username, setUsername] = useState(profile?.username ? `@${profile.username}` : '');
  const [bio, setBio] = useState(profile?.bio ?? '');

  async function handleSave() {
    await updateProfile({
      firstName,
      lastName,
      // strip leading '@' before saving
      username: username.replace(/^@/, ''),
      bio,
    });
    router.back();
  }

  return (
    <ScreenShell>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <AppView mt={14} gap={28}>
            {/* Header */}
            <AppView px={16}>
              <AppView row align="center">
                <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
                  <AppPressableView
                    row
                    align="center"
                    androidRipple={false}
                    onPress={() => router.back()}
                  >
                    <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
                  </AppPressableView>
                </AppView>

                <AppText
                  textVariant="title"
                  family="heading"
                  weight="bold"
                  style={{ textAlign: 'center' }}
                >
                  Edit Profile
                </AppText>

                {/* Save button top-right */}
                <AppView style={{ flex: 1, alignItems: 'flex-end' }}>
                  <AppPressableView
                    center
                    rounded={36}
                    androidRipple={false}
                    onPress={handleSave}
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: tokens.brand,
                    }}
                  >
                    <Check size={16} strokeWidth={2.4} color={tokens.onBrand} />
                  </AppPressableView>
                </AppView>
              </AppView>
            </AppView>

            {/* Avatar section */}
            <AppView align="center" gap={10}>
              <AppView style={{ position: 'relative' }}>
                {/* Avatar circle */}
                <AppView
                  center
                  rounded={36}
                  style={{
                    width: 100,
                    height: 100,
                    backgroundColor: tokens.backgroundSecondary,
                    borderWidth: 3,
                    borderColor: tokens.border,
                  }}
                >
                  <AppText textVariant="title" family="heading" weight="bold" colorName="text">
                    MA
                  </AppText>
                </AppView>

                {/* Camera badge */}
                <AppPressableView
                  center
                  rounded={36}
                  androidRipple={false}
                  pressedOpacity={0.75}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 32,
                    height: 32,
                    backgroundColor: tokens.brand,
                    borderWidth: 2,
                    borderColor: tokens.background,
                  }}
                >
                  <Camera size={15} strokeWidth={2.1} color={tokens.onBrand} />
                </AppPressableView>
              </AppView>

              <AppText textVariant="bodyXs" colorName="gray400">
                Tap camera to update photo
              </AppText>
            </AppView>

            {/* Form fields */}
            <AppView px={16} gap={16}>
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

              <AppTextField
                label="Username"
                placeholder="@username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <AppTextField
                label="Bio"
                placeholder="Tell us a little about yourself…"
                value={bio}
                onChangeText={setBio}
                autoCapitalize="sentences"
              />
            </AppView>

            {/* Save button bottom */}
            <AppView px={16}>
              <AppPressableView
                center
                rounded={16}
                androidRipple={false}
                onPress={handleSave}
                style={{
                  height: 52,
                  backgroundColor: tokens.brand,
                }}
              >
                <AppText
                  textVariant="button"
                  family="accent"
                  weight="semibold"
                  style={{ color: tokens.onBrand }}
                >
                  Save Changes
                </AppText>
              </AppPressableView>
            </AppView>
          </AppView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
