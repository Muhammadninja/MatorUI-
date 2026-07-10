import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import AppImage from '@/components/shared/app-image';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

type RecentlyViewedItem = {
  id: string;
  name: string;
  price: string;
  /** Seed for the placeholder image — each tile gets distinct imagery. */
  imageSeed: string;
};

const RECENTLY_VIEWED: RecentlyViewedItem[] = [
  { id: '1', name: 'Garrett GTX3582R', price: '$2,150', imageSeed: 'turbo-garrett' },
  { id: '2', name: 'Vossen HF-5', price: '$3,400', imageSeed: 'wheel-vossen' },
  { id: '3', name: 'KW Coilovers V3', price: '$1,890', imageSeed: 'coilovers-kw' },
  { id: '4', name: 'Brembo GT Kit', price: '$2,640', imageSeed: 'brakes-brembo' },
];

export default function ProfileRecentlyViewed() {
  const { tokens } = useThemeContext();

  const handleViewAll = () => {
    router.push('/recently-viewed');
  };

  const openItem = (id: string) => {
    router.push(`/item-detail/${id}`);
  };

  return (
    <AppView gap={10}>
      <AppView row align="center" justify="flex-end" px="lg">
        <AppPressableView
          androidRipple={false}
          pressedOpacity={0.6}
          onPress={handleViewAll}
          accessibilityRole="button"
          accessibilityLabel="View all recently viewed"
        >
          <AppText textVariant="bodySm" weight="semibold" colorName="text">
            View all recently viewed
          </AppText>
        </AppPressableView>
      </AppView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
      >
        {RECENTLY_VIEWED.map((item) => (
          <AppPressableView
            key={item.id}
            rounded={16}
            androidRipple={false}
            pressedOpacity={0.88}
            pressedScale={0.98}
            onPress={() => openItem(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.price}`}
            style={{
              width: 140,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.card,
              overflow: 'hidden',
            }}
          >
            <AppImage
              source={{ uri: `https://picsum.photos/seed/${item.imageSeed}/280/220` }}
              width="100%"
              height={110}
              contentFit="cover"
              alt={item.name}
            />

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
