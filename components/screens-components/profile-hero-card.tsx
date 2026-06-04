import { router } from 'expo-router';
import { Pencil, Shield, Star } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { Platform } from 'react-native';

export default function ProfileHeroCard() {
  const { tokens } = useThemeContext();
  const { profile } = useUserContext();

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : 'Loading...';
  const initials = profile ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase() : '—';
  const isPremium = profile?.isPremium ?? false;

  return (
    <AppView
      rounded={36}
      px={18}
      py={24}
      gap={14}
      align="center"
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
        // 3-D layered shadow
        ...Platform.select({
          ios: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.18,
            shadowRadius: 24,
          },
          android: { elevation: 14 },
        }),
      }}
    >
      <AppView style={{ position: 'relative' }}>
        <AppView
          center
          rounded={36}
          style={{
            width: 90,
            height: 90,
            backgroundColor: tokens.backgroundSecondary,
            borderWidth: 3,
            borderColor: tokens.border,
          }}
        >
          <AppText textVariant="title" family="heading" weight="bold" colorName="text">
            {initials}
          </AppText>
        </AppView>
        <AppPressableView
          center
          rounded={36}
          androidRipple={false}
          pressedOpacity={0.7}
          onPress={() => router.push('/edit-profile')}
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
      </AppView>

      <AppView align="center" gap={6}>
        <AppText
          textVariant="title"
          family="heading"
          weight="bold"
          colorName="text"
          style={{ textAlign: 'center' }}
        >
          {displayName}
        </AppText>
        <AppView row align="center" gap={5}>
          {isPremium ? (
            <Star size={11} strokeWidth={2.2} color="#F5C518" fill="#F5C518" />
          ) : (
            <Shield size={11} strokeWidth={2.2} color={tokens.gray400} />
          )}
          <AppText
            textVariant="caption"
            family="accent"
            weight="semibold"
            style={{ color: isPremium ? '#F5C518' : tokens.gray400 }}
            transform="uppercase"
          >
            {isPremium ? 'Premium Member' : 'Standard Member'}
          </AppText>
        </AppView>
      </AppView>
    </AppView>
  );
}
