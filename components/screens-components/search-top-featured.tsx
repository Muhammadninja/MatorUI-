import { router } from 'expo-router';

import { AppText } from '../shared/app-text';
import { AppPressableView, AppView } from '../shared/app-view';
import SearchPartCard from './search-part-card';
import TOP_FEATURED_ITEMS from './search-top-featured.data';

export default function SearchTopFeatured() {
  return (
    <AppView mt={18} gap={16}>
      <AppView px={16} row align="center" justify="space-between" gap={12}>
        <AppText textVariant="title" family="heading" weight="bold">
          Top Featured
        </AppText>
        <AppPressableView
          row
          align="center"
          androidRipple={false}
          onPress={() => router.push('/top-featured')}
        >
          <AppText
            textVariant="bodySm"
            colorName="gray400"
            weight="bold"
            style={{ textDecorationLine: 'underline' }}
          >
            View all {'>'}
          </AppText>
        </AppPressableView>
      </AppView>

      <AppView px={16}>
        <AppView row gap={12} justify="space-between" style={{ flexWrap: 'wrap' }}>
          {TOP_FEATURED_ITEMS.map((item) => (
            <SearchPartCard
              key={item.id}
              id={item.id}
              badge={item.badge}
              status={item.status}
              title={item.title}
              description={item.description}
              price={item.price}
              actionLabel="Add"
              compact
              style={{ width: '48%' }}
            />
          ))}
        </AppView>
      </AppView>
    </AppView>
  );
}
