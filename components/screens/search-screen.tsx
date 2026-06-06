import { router } from 'expo-router';

import ScreenShell from '@/components/screens-components/screen-shell';
import SearchQuickFilters from '@/components/screens-components/search/search-quick-filters';
import SmartSearchBar from '@/components/screens-components/search/smart-search-bar';
import SearchCatalogue from '../screens-components/search/search-catalogue';
import SearchPromoBanner from '../screens-components/search/search-promo-banner';
import SearchTopFeatured from '../screens-components/search/search-top-featured';
import AppScrollView from '../shared/app-scroll-view/app-scroll-view';

export default function SearchScreen() {
  return (
    <ScreenShell
      topSlot={<SmartSearchBar onNotificationPress={() => router.push('/notifications')} />}
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
