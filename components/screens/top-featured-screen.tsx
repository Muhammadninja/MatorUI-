import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, PackageOpen } from 'lucide-react-native';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchPartCard from '@/components/screens-components/search/search-part-card';
import SearchTopFeaturedSkeleton from '@/components/screens-components/search/search-top-featured-skeleton';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import useTopFeaturedList from '@/hooks/use-top-featured-list';

/**
 * Top Featured — full list page for the prototype's `scFeatured`. Data
 * comes from `useTopFeaturedList` → `top-featured-service`, which POSTs
 * to `/v1/top-featured/list` when `EXPO_PUBLIC_API_BASE_URL` is set and
 * falls back to the fixtures otherwise. Renders the four UI states
 * (loading / error / empty / success) and honors an optional `brand`
 * route param (passed by the explore landing's "View all" when a brand
 * chip is active) so the grid opens pre-filtered.
 */
export default function TopFeaturedScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { brand } = useLocalSearchParams<{ brand?: string }>();

  const { state, items, error, refresh } = useTopFeaturedList({
    page: 1,
    pageSize: 24,
    filters: brand ? { brand } : {},
  });

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={brand ? brand : 'Top Featured'} fallbackHref="/explore" />

      {state === 'idle' || state === 'loading' ? (
        <SearchTopFeaturedSkeleton />
      ) : state === 'error' ? (
        <AppView flex={1} center px="lg" gap="md">
          <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
          <AppView gap="xs" align="center">
            <AppText textVariant="bodySemibold">Couldn&apos;t load top featured</AppText>
            <AppText
              textVariant="bodySm"
              colorName="gray400"
              style={{ textAlign: 'center', maxWidth: 280 }}
            >
              {error ?? 'Something went wrong. Try again.'}
            </AppText>
          </AppView>
          <AppButton title="Retry" kind="secondary" size="sm" onPress={refresh} />
        </AppView>
      ) : state === 'empty' ? (
        <AppView flex={1} center px="lg" gap={10}>
          <PackageOpen size={32} strokeWidth={2} color={tokens.gray400} />
          <AppText textVariant="bodySm" colorName="gray400" style={{ textAlign: 'center' }}>
            {brand ? `No results for ${brand} yet.` : 'Nothing featured right now.'}
          </AppText>
        </AppView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 24, 40),
          }}
        >
          <AppView row gap="md" justify="space-between" style={{ flexWrap: 'wrap' }}>
            {items.map((item) => (
              <SearchPartCard
                key={item.id}
                id={item.id}
                badge={item.badge}
                status={item.status}
                title={item.title}
                description={item.description}
                price={item.price}
                oem={item.oem}
                image={item.images?.[0]}
                compact
                style={{ width: '48%' }}
                onPress={() =>
                  router.push({
                    pathname: '/item-detail/[id]',
                    params: { id: item.id },
                  })
                }
              />
            ))}
          </AppView>
        </ScrollView>
      )}
    </AppView>
  );
}
