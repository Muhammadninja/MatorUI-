import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const RECENTLY_VIEWED = [
  { id: '1', name: 'Garrett GTX3582R', price: '$2,150' },
  { id: '2', name: 'Vossen HF-5', price: '$3,400' },
  { id: '3', name: 'KW Coilovers V3', price: '$1,890' },
  { id: '4', name: 'Brembo GT Kit', price: '$2,640' },
] as const;

export default function ProfileRecentlyViewed() {
  const { tokens } = useThemeContext();

  return (
    <AppView gap={12} px={10}>
      <AppView row align="center" justify="space-between">
        <AppText textVariant="subtitle" family="accent" weight="semibold" colorName="text">
          Recently Viewed
        </AppText>
        <AppPressableView
          androidRipple={false}
          pressedOpacity={0.6}
          onPress={() => router.push('/recently-viewed')}
        >
          <AppText
            textVariant="bodySm"
            weight="semibold"
            colorName="gray400"
            style={{ textDecorationLine: 'underline' }}
          >
            View All
          </AppText>
        </AppPressableView>
      </AppView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 4 }}
      >
        {RECENTLY_VIEWED.map((item) => (
          <AppPressableView
            key={item.id}
            rounded={20}
            androidRipple={false}
            pressedOpacity={0.88}
            pressedScale={0.98}
            style={{
              width: 140,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.card,
              overflow: 'hidden',
            }}
          >
            {/* Image */}
            <Image
              source={require('@/assets/images/test-image.png')}
              style={{ width: '100%', height: 110 }}
              contentFit="cover"
            />

            {/* Name and price */}
            <AppView px={10} py={10} gap={3}>
              <AppText textVariant="bodySm" weight="semibold" colorName="text" numberOfLines={2}>
                {item.name}
              </AppText>
              <AppText textVariant="bodyXs" weight="bold" colorName="text">
                {item.price}
              </AppText>
            </AppView>
          </AppPressableView>
        ))}
      </ScrollView>
    </AppView>
  );
}
