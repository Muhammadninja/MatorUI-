import { router } from 'expo-router';
import { AlertCircle, ChevronRight, PackageOpen } from 'lucide-react-native';
import { View } from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { useThemeContext } from '@/contexts/theme.context';
import useTopFeaturedList from '@/hooks/use-top-featured-list';

import { AppText } from '../../shared/app-text';
import { AppPressableView, AppView } from '../../shared/app-view';
import SearchPartCard from './search-part-card';
import SearchTopFeaturedSkeleton from './search-top-featured-skeleton';

export type SearchTopFeaturedProps = {
  /**
   * When set, the grid is filtered to this brand and the section
   * re-skins as a results block: the "Top Featured" header is replaced
   * with "Results for <brand>". Driven by the quick-filter chip
   * selection on the explore landing — null/undefined renders the full
   * (unfiltered) Top Featured grid as before.
   */
  brand?: string | null;
};

/**
 * Top Featured grid on the explore landing. Consumes
 * `useTopFeaturedList` with empty default filters and renders the four
 * UI states: idle/loading → skeleton, error → retry, empty →
 * placeholder, success → 2-column card grid.
 */
export default function SearchTopFeatured({ brand }: SearchTopFeaturedProps = {}) {
  const { tokens } = useThemeContext();
  const { state, items, error, refresh } = useTopFeaturedList({
    page: 1,
    pageSize: 6,
    filters: brand ? { brand } : {},
  });

  return (
    <AppView mt={18} gap="lg">
      <AppView px="lg" row align="center" justify="space-between" gap="md">
        <AppText textVariant="title" family="heading" weight="bold">
          {brand ? ` ${brand}` : 'Top Featured'}
        </AppText>
        <AppPressableView
          androidRipple={false}
          onPress={() =>
            // When a brand chip is active on the explore landing, pass
            // it through as a route param so the View All page opens
            // with that brand locked in (and its Model filter row
            // hidden — the user already picked the car, no need to
            // also pick a body style).
            router.push(
              brand
                ? { pathname: '/top-featured', params: { brand } }
                : '/top-featured',
            )
          }
          accessibilityLabel="View all top featured items"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <AppText textVariant="bodySm" colorName="gray400" weight="bold">
              View all
            </AppText>
            <ChevronRight size={14} strokeWidth={2} color={tokens.gray400} />
          </View>
        </AppPressableView>
      </AppView>

      {state === 'idle' || state === 'loading' ? (
        <SearchTopFeaturedSkeleton />
      ) : state === 'error' ? (
        <AppView px="lg" gap="md" align="center" py="xl">
          <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
          <AppView gap="xs" align="center">
            <AppText textVariant="bodySemibold">Couldn't load top featured</AppText>
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
        <AppView px="lg" gap={10} align="center" py="xl">
          <PackageOpen size={32} strokeWidth={2} color={tokens.gray400} />
          <AppText
            textVariant="bodySm"
            colorName="gray400"
            style={{ textAlign: 'center' }}
          >
            {brand ? `No results for ${brand} yet.` : 'Nothing featured right now.'}
          </AppText>
        </AppView>
      ) : (
        <AppView px="lg">
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
        </AppView>
      )}
    </AppView>
  );
}
