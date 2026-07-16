import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { LOGO_BRANDS } from '@/components/screens-components/catalog/brand-logo';
import CategoryTile from '@/components/screens-components/catalog/category-tile';
import CertifiedSection from '@/components/screens-components/catalog/certified-section';
import MatorFitBanner from '@/components/screens-components/catalog/mator-fit-banner';
import VehicleMakeTile from '@/components/screens-components/catalog/vehicle-make-tile';
import { AppLogo } from '@/components/shared/app-logo';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { useToast } from '@/hooks/use-toast';
import { categoryRouteFor, MATOR_CAT_TILES } from '@/mocks/mator-catalog';
import { triggerHaptic } from '@/utils/haptics';

// Soft feather under the header so the frosted panel dissolves into the
// content instead of ending in a hard seam ("dropline").
const HEADER_FADE = 24;

/**
 * Explore (home) — v2 AutoZone-style **category browser** (not a product
 * list). A frosted sticky header (greeting + notifications + pill search)
 * over a scroll of: the vehicle-fit banner, a "Shop by vehicle" make row
 * with custom car silhouettes, and a colorful "Shop by category" grid with
 * custom part icons. Tiles route to the Make / Category screens.
 */
export default function ExploreScreen() {
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const dark = scheme === 'dark';
  // Measured header height; the scroll content is padded by this much so it
  // starts below the frosted panel it scrolls under.
  const [headerHeight, setHeaderHeight] = useState(insets.top + 132);
  const toast = useToast();

  // Pull-to-refresh — a branded wheel bar replaces the stock spinner; on
  // release it "refreshes" (~1.2s) then confirms with a toast.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success('Prices & stock updated');
    }, 1200);
  }, [toast]);

  const openCategory = useCallback((name: string) => {
    triggerHaptic('selection');
    const { cat, label } = categoryRouteFor(name);
    router.push({ pathname: '/category', params: { cat, label } });
  }, []);
  const openMake = useCallback((brandId: string) => {
    triggerHaptic('selection');
    router.push({ pathname: '/make', params: { make: brandId } });
  }, []);

  return (
    <AppView flex={1} colorName="background">
      {/* Frosted sticky header — greeting + notifications + pill search. */}
      <AppView
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
      >
        <BlurView
          intensity={dark ? 40 : 60}
          tint={dark ? 'dark' : 'light'}
          blurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <AppView
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // ~0.82 alpha (0xd1) over the theme background = the frosted wash.
            backgroundColor: `${tokens.background}d1`,
          }}
        />
        <AppView style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, gap: 12 }}>
          <AppView row align="center" justify="space-between">
            <AppLogo size={26} />
            <AppPressableView
              onPress={() => router.push('/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              androidRipple={false}
              center
              style={{ width: 42, height: 42 }}
            >
              <Bell size={21} strokeWidth={2.2} color={tokens.text} />
              <AppView
                style={{
                  position: 'absolute',
                  top: 9,
                  right: 10,
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: tokens.error,
                  borderWidth: 2,
                  borderColor: tokens.card,
                }}
              />
            </AppPressableView>
          </AppView>

          <AppPressableView
            testID="explore-search-entry"
            onPress={() => router.push('/search')}
            accessibilityRole="search"
            accessibilityLabel="Search parts, brands, OEM number"
            androidRipple={false}
            row
            align="center"
            gap={10}
            rounded={999}
            px={18}
            py={13}
            colorName="backgroundSecondary"
            borderWidth={1}
            borderName="border"
          >
            <Search size={20} strokeWidth={2.2} color={tokens.textMuted} />
            <AppText family="default" style={{ fontSize: 15, color: tokens.textMuted }}>
              Search parts, brands, OEM #
            </AppText>
          </AppPressableView>
        </AppView>

        {/* Blended dropline — the panel feathers into the content below. */}
        <Svg
          pointerEvents="none"
          width="100%"
          height={HEADER_FADE}
          style={{ position: 'absolute', left: 0, right: 0, bottom: -HEADER_FADE }}
        >
          <Defs>
            <SvgLinearGradient id="exploreFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tokens.background} stopOpacity={1} />
              <Stop offset="1" stopColor={tokens.background} stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={HEADER_FADE} fill="url(#exploreFade)" />
        </Svg>
      </AppView>

      {/* Branded pull-to-refresh bar — sits just under the frosted header
       *  while refreshing, replacing the stock RefreshControl spinner. */}
      {refreshing ? (
        <AppView
          row
          center
          gap={10}
          colorName="background"
          style={{
            position: 'absolute',
            top: headerHeight,
            left: 0,
            right: 0,
            height: 52,
            zIndex: 9,
            borderBottomWidth: 1,
            borderBottomColor: tokens.divider,
          }}
        >
          <WheelLoader size={22} color={tokens.text} />
          <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
            Refreshing…
          </AppText>
        </AppView>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['transparent']}
            progressViewOffset={headerHeight}
          />
        }
        contentContainerStyle={{
          paddingTop: headerHeight + 12,
          paddingHorizontal: 20,
          paddingBottom: 28,
          gap: 16,
        }}
      >
        <MatorFitBanner />

        {/* ── Shop by vehicle ── */}
        <AppView row align="center" justify="space-between" style={{ marginTop: 2 }}>
          <AppText family="heading" weight="bold" style={{ fontSize: 18}}>
            Shop by vehicle
          </AppText>
          <AppPressableView onPress={() => router.navigate('/garage')} androidRipple={false} accessibilityRole="button">
            <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
              My garage ›
            </AppText>
          </AppPressableView>
        </AppView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingVertical: 2 }}
          style={{ marginHorizontal: -20 }}
        >
          {LOGO_BRANDS.map((b) => (
            <VehicleMakeTile key={b.id} brandId={b.id} label={b.label} onPress={openMake} />
          ))}
        </ScrollView>

        {/* ── MATOR Certified ── */}
        <CertifiedSection />

        {/* ── Shop by category ── */}
        <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text, marginTop: 6 }}>
          Shop by category
        </AppText>
        <AppView row wrap justify="space-between" style={{ rowGap: 12 }}>
          {MATOR_CAT_TILES.map((c) => (
            <CategoryTile key={c.name} name={c.name} count={c.count} onPress={openCategory} />
          ))}
        </AppView>
      </ScrollView>
    </AppView>
  );
}
