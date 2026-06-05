import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchCatalogue from '@/components/screens-components/search-catalogue';
import SearchPromoBanner from '@/components/screens-components/search-promo-banner';
import SearchQuickFilters from '@/components/screens-components/search-quick-filters';
import SearchTopFeatured from '@/components/screens-components/search-top-featured';
import SmartSearchBar from '@/components/screens-components/smart-search-bar';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const SEARCH_BAR_HEIGHT = 52;
const FADE_HEIGHT = 24;
const FADE_STEPS = [0.9, 0.75, 0.6, 0.45, 0.3, 0.18, 0.08, 0.02];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { scheme, tokens } = useThemeContext();
  // Push content below the entire blur strip (safe area + bar + fade) so the
  // quick-filter chips at the top of the scroll aren't obscured by the search.
  const topOffset = insets.top + SEARCH_BAR_HEIGHT + FADE_HEIGHT;
  // expo-blur on Android renders a translucent gray fallback (no real backdrop
  // blur), which shows as an ugly gray shadow around the search bar. Fall back
  // to a solid theme-bg fill on Android — the bottom fade gradient still works
  // because the MaskedView mask is independent of the fill content.
  const isAndroid = Platform.OS === 'android';

  return (
    <AppView flex={1} colorName="background">
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topOffset }}
        contentInsetAdjustmentBehavior="never"
      >
        <SearchQuickFilters />
        <SearchCatalogue />
        <SearchPromoBanner />
        <SearchTopFeatured />
      </AppScrollView>

      <MaskedView
        style={[styles.blurContainer, { height: insets.top + SEARCH_BAR_HEIGHT + FADE_HEIGHT }]}
        maskElement={
          <View style={styles.maskWrapper}>
            <View style={styles.maskSolid} />
            <View style={styles.maskFade}>
              {FADE_STEPS.map((opacity, i) => (
                <View key={i} style={[styles.fadeBand, { opacity }]} />
              ))}
            </View>
          </View>
        }
      >
        {isAndroid ? (
          <View style={[styles.blurFill, { backgroundColor: tokens.background }]} />
        ) : (
          <BlurView
            tint={scheme === 'dark' ? 'dark' : 'light'}
            intensity={80}
            style={styles.blurFill}
          />
        )}
      </MaskedView>

      <View
        pointerEvents="box-none"
        style={[styles.searchBarOverlay, { paddingTop: insets.top }]}
      >
        <SmartSearchBar
          onNotificationPress={() => router.push('/notifications')}
        />
      </View>
    </AppView>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  blurFill: {
    flex: 1,
  },
  searchBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  maskWrapper: {
    flex: 1,
  },
  maskSolid: {
    flex: 1,
    backgroundColor: 'black',
  },
  maskFade: {
    height: FADE_HEIGHT,
    flexDirection: 'column',
  },
  fadeBand: {
    flex: 1,
    backgroundColor: 'black',
  },
});
