import { router } from 'expo-router';
import { Eye } from 'lucide-react-native';

import AppImage from '@/components/shared/app-image';
import AppList from '@/components/shared/app-list';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

type RecentlyViewedItem = {
  id: string;
  name: string;
  brand: string;
  price: string;
  /** Picsum seed — gives each tile a distinct, stable preview image so
   *  the grid actually reads as varied product photography until the
   *  real catalog images land. */
  seed: string;
};

const ALL_RECENTLY_VIEWED: RecentlyViewedItem[] = [
  { id: '1', name: 'GTX3582R Turbo', brand: 'Garrett', price: '$2,150', seed: 'matorui-turbo' },
  { id: '2', name: 'HF-5 Wheels', brand: 'Vossen', price: '$3,400', seed: 'matorui-wheels' },
  { id: '3', name: 'V3 Coilovers', brand: 'KW', price: '$1,890', seed: 'matorui-coilovers' },
  { id: '4', name: 'GT Big Brake Kit', brand: 'Brembo', price: '$2,640', seed: 'matorui-brakes' },
  { id: '5', name: 'Titanium Exhaust', brand: 'Akrapovic', price: '$1,320', seed: 'matorui-exhaust' },
  { id: '6', name: 'Sportster CS Seat', brand: 'Recaro', price: '$890', seed: 'matorui-seat' },
  { id: '7', name: 'Super SQV4 BOV', brand: 'HKS', price: '$420', seed: 'matorui-bov' },
  { id: '8', name: 'Pro-Kit Springs', brand: 'Eibach', price: '$340', seed: 'matorui-springs' },
];

export default function RecentlyViewedScreen() {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  const openItem = (id: string) => {
    triggerHaptic('selection');
    router.push({ pathname: '/item-detail/[id]', params: { id } });
  };

  const header = (
    <AppView px="lg" pb="md" row align="center" gap="sm">
      <Eye size={14} strokeWidth={2.2} color={tokens.gray400} />
      <AppText textVariant="bodySm" colorName="gray400">
        {ALL_RECENTLY_VIEWED.length} parts viewed in the last 30 days
      </AppText>
    </AppView>
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Recently Viewed" fallbackHref="/profile" />
      <AppList<RecentlyViewedItem>
        data={ALL_RECENTLY_VIEWED}
        numColumns={2}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <AppView px="sm" pb="md">
            <AppPressableView
              rounded={20}
              androidRipple={false}
              pressedOpacity={0.88}
              pressedScale={0.98}
              onPress={() => openItem(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${item.brand} ${item.name}, ${item.price}`}
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: isDark ? tokens.card : tokens.white,
                overflow: 'hidden',
              }}
            >
              <AppImage
                source={{ uri: `https://picsum.photos/seed/${item.seed}/320/320` }}
                width="100%"
                height={132}
                contentFit="cover"
                alt={`${item.brand} ${item.name}`}
              />
              <AppView px="md" py="sm" gap="xs">
                <AppText
                  textVariant="bodyXs"
                  weight="bold"
                  style={{ color: tokens.brand, letterSpacing: 0.4 }}
                  transform="uppercase"
                  numberOfLines={1}
                >
                  {item.brand}
                </AppText>
                <AppText textVariant="bodySm" weight="semibold" colorName="text" numberOfLines={2}>
                  {item.name}
                </AppText>
                <AppText textVariant="bodySemibold" weight="bold" colorName="text">
                  {item.price}
                </AppText>
              </AppView>
            </AppPressableView>
          </AppView>
        )}
      />
    </AppView>
  );
}
