import { router } from 'expo-router';

import ScreenShell from '@/components/screens-components/screen-shell';
import SearchCatalogue from '@/components/screens-components/search-catalogue';
import SearchPromoBanner from '@/components/screens-components/search-promo-banner';
import SearchQuickFilters from '@/components/screens-components/search-quick-filters';
import SearchTopFeatured from '@/components/screens-components/search-top-featured';
import SmartSearchBar from '@/components/screens-components/smart-search-bar';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';

export default function ExploreScreen() {
  return (
    <ScreenShell
      topSlot={
        <SmartSearchBar
          onNotificationPress={() => router.push('/notifications')}
        />
      }
    >
      <AppScrollView showsVerticalScrollIndicator={false}>
        <SearchQuickFilters />
        <SearchCatalogue />
        <SearchPromoBanner />
        <SearchTopFeatured />
      </AppScrollView>
    </ScreenShell>
  );
}
