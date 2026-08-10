import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';

// Unified elevation tier used across all profile-screen cards. Keep this
// shape in sync with profile-payment-methods.tsx and profile-guest-empty.tsx
// so the screen doesn't speak three different shadow languages.
const CARD_ELEVATION = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 6 },
});

export default function ProfileHeroCard() {
  const { tokens } = useThemeContext();
  const { t } = useTranslation();
  const { profile } = useUserContext();

  const hasProfile = !!profile;
  // Names can be blank (e.g. a freshly-created account), so guard every
  // character access and fall back to sensible labels rather than rendering
  // an empty avatar/name.
  const fullName = profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() : '';
  const displayName = !profile ? t('profileCards.loading') : fullName || t('profileCards.yourProfile');
  const initials = profile
    ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || 'M'
    : '••';

  // Show the uploaded photo when we have one; fall back to initials if it's
  // missing OR fails to load (e.g. a dead/removed Cloudinary URL) so the circle
  // is never blank. Reset the error flag when the URL changes so a re-upload
  // gets a fresh chance to render.
  const avatarUrl = profile?.avatarUrl ?? null;
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [avatarUrl]);
  const showAvatar = !!avatarUrl && !imgFailed;

  return (
    <AppView
      rounded={16}
      px={18}
      py="xl"
      gap="md"
      align="center"
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
        ...CARD_ELEVATION,
      }}
    >
      <AppView style={{ position: 'relative' }}>
        <AppView
          center
          rounded={999}
          style={{
            width: 90,
            height: 90,
            overflow: 'hidden',
            backgroundColor: tokens.backgroundSecondary,
            borderWidth: 1,
            borderColor: tokens.border,
          }}
        >
          {showAvatar ? (
            <Image
              source={{ uri: avatarUrl! }}
              style={{ width: 90, height: 90 }}
              contentFit="cover"
              transition={150}
              onError={() => setImgFailed(true)}
              accessibilityLabel={t('profileCards.profilePhoto')}
            />
          ) : (
            <AppText textVariant="title" family="heading" weight="bold" colorName="text">
              {initials}
            </AppText>
          )}
        </AppView>
        {hasProfile ? (
          <AppPressableView
            center
            rounded={999}
            androidRipple={false}
            pressedOpacity={0.7}
            onPress={() => router.push('/edit-profile')}
            accessibilityRole="button"
            accessibilityLabel={t('profileCards.editProfile')}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 28,
              height: 28,
              backgroundColor: tokens.brand,
              borderWidth: 2,
              borderColor: tokens.background,
            }}
          >
            <Pencil size={12} strokeWidth={2.3} color={tokens.onBrand} />
          </AppPressableView>
        ) : null}
      </AppView>

      <AppView align="center" gap="xs">
        <AppText
          textVariant="title"
          family="heading"
          weight="bold"
          colorName="text"
          style={{ textAlign: 'center' }}
        >
          {displayName}
        </AppText>
      </AppView>
    </AppView>
  );
}
