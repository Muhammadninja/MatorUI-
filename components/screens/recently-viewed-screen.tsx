import AppImage from '@/components/shared/app-image';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import ScreenShell from '@/components/screens-components/screen-shell';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const ALL_RECENTLY_VIEWED = [
  { id: '1', name: 'Garrett GTX3582R Turbo', price: '$2,150' },
  { id: '2', name: 'Vossen HF-5 Wheels', price: '$3,400' },
  { id: '3', name: 'KW Coilovers V3 Suspension Kit', price: '$1,890' },
  { id: '4', name: 'Brembo GT Big Brake Kit', price: '$2,640' },
  { id: '5', name: 'Akrapovic Titanium Exhaust', price: '$1,320' },
  { id: '6', name: 'Recaro Sportster CS Seat', price: '$890' },
  { id: '7', name: 'HKS Super SQV4 BOV', price: '$420' },
  { id: '8', name: 'Eibach Pro-Kit Springs', price: '$340' },
] as const;

export default function RecentlyViewedScreen() {
  const { tokens } = useThemeContext();

  return (
    <ScreenShell>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <AppView mt={14} gap={20}>
          {/* Header */}
          <AppView px={16} gap={6}>
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
                Recently Viewed
              </AppText>
              <AppView style={{ flex: 1 }} />
            </AppView>
            <AppText textVariant="bodySm" colorName="gray400" style={{ textAlign: 'center' }}>
              {ALL_RECENTLY_VIEWED.length} items
            </AppText>
          </AppView>

          {/* Grid */}
          <AppView px={16} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {ALL_RECENTLY_VIEWED.map((item) => (
              <AppPressableView
                key={item.id}
                rounded={20}
                androidRipple={false}
                pressedOpacity={0.88}
                pressedScale={0.98}
                style={{
                  width: '47%',
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: tokens.card,
                  overflow: 'hidden',
                }}
              >
                <AppImage
                  source={require('@/assets/images/test-image.png')}
                  width="100%"
                  height={120}
                  contentFit="cover"
                  alt={item.name}
                />
                <AppView px={10} py={10} gap={3}>
                  <AppText
                    textVariant="bodySm"
                    weight="semibold"
                    colorName="text"
                    numberOfLines={2}
                  >
                    {item.name}
                  </AppText>
                  <AppText textVariant="bodyXs" weight="bold" colorName="text">
                    {item.price}
                  </AppText>
                </AppView>
              </AppPressableView>
            ))}
          </AppView>
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
