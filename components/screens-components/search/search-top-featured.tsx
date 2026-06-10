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

/**
 * Top Featured grid on the explore landing. Consumes
 * `useTopFeaturedList` with empty default filters and renders the four
 * UI states: idle/loading → skeleton, error → retry, empty →
 * placeholder, success → 2-column card grid.
 */
export default function SearchTopFeatured() {
  const { tokens } = useThemeContext();
  const { state, items, error, refresh } = useTopFeaturedList({
    page: 1,
    pageSize: 6,
    filters: {},
  });

  return (
    <AppView mt={18} gap={16}>
      <AppView px={16} row align="center" justify="space-between" gap={12}>
        <AppText textVariant="title" family="heading" weight="bold">
          Top Featured
        </AppText>
        <AppPressableView
          androidRipple={false}
          onPress={() => router.push('/top-featured')}
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
        <AppView px={16} gap={12} align="center" py={24}>
          <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
          <AppView gap={4} align="center">
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
        <AppView px={16} gap={10} align="center" py={24}>
          <PackageOpen size={32} strokeWidth={2} color={tokens.gray400} />
          <AppText
            textVariant="bodySm"
            colorName="gray400"
            style={{ textAlign: 'center' }}
          >
            Nothing featured right now.
          </AppText>
        </AppView>
      ) : (
        <AppView px={16}>
          <AppView row gap={12} justify="space-between" style={{ flexWrap: 'wrap' }}>
            {items.map((item) => (
              <SearchPartCard
                key={item.id}
                id={item.id}
                badge={item.badge}
                status={item.status}
                title={item.title}
                description={item.description}
                price={item.price}
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
