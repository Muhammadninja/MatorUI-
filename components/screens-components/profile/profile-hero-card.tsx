import { router } from 'expo-router';
import { Pencil } from 'lucide-react-native';
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
  const { profile } = useUserContext();

  const hasProfile = !!profile;
  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : 'Loading…';
  const initials = profile ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase() : '••';
  return (
    <AppView
      rounded={16}
      px={18}
      py={24}
      gap={12}
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
            backgroundColor: tokens.backgroundSecondary,
            borderWidth: 1,
            borderColor: tokens.border,
          }}
        >
          <AppText textVariant="title" family="heading" weight="bold" colorName="text">
            {initials}
          </AppText>
        </AppView>
        {hasProfile ? (
          <AppPressableView
            center
            rounded={999}
            androidRipple={false}
            pressedOpacity={0.7}
            onPress={() => router.push('/edit-profile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
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

      <AppView align="center" gap={4}>
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
