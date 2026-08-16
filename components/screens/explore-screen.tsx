import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CategoryGridSkeleton, {
  BrandRowSkeleton,
} from '@/components/screens-components/catalog/category-grid-skeleton';
import CategoryTile from '@/components/screens-components/catalog/category-tile';
import CertifiedSection from '@/components/screens-components/catalog/certified-section';
import MatorFitBanner from '@/components/screens-components/catalog/mator-fit-banner';
import VehicleMakeTile from '@/components/screens-components/catalog/vehicle-make-tile';
import { AppLogo } from '@/components/shared/app-logo';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { useCategoryDrill } from '@/hooks/use-category-drill';
import { useSystemCategories } from '@/hooks/use-system-categories';
import { useMakes } from '@/hooks/use-vehicle-catalog';
import { useNotifications } from '@/hooks/use-notifications';
import { useToast } from '@/hooks/use-toast';
import { modalService } from '@/services/global-modal-service/global-modal.service';
import { triggerHaptic } from '@/utils/haptics';

// Soft feather under the header so the frosted panel dissolves into the
// content instead of ending in a hard seam ("dropline").
const HEADER_FADE = 24;

// Number of bands in the feather. More = smoother ramp; 14 over 24px (~1.7px
// each) reads as a continuous fade.
const HEADER_FADE_BANDS = 14;

/**
 * Pure-View replacement for what used to be an SVG linear-gradient. Stacks thin
 * bands of the background colour with opacity ramping opaque→transparent,
 * top→bottom. Avoids react-native-svg's benign-but-noisy "No stops in gradient"
 * paint-order warning (a `<Rect fill="url(#…)">` can paint a frame before its
 * `<Defs>` stops commit) with zero new dependencies.
 */
function HeaderFade({ color, height }: { color: string; height: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: -height, height }}
    >
      {Array.from({ length: HEADER_FADE_BANDS }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: color,
            opacity: 1 - i / (HEADER_FADE_BANDS - 1),
          }}
        />
      ))}
    </View>
  );
}

/**
 * Explore (home) — v2 AutoZone-style **category browser** (not a product
 * list). A frosted sticky header (greeting + notifications + pill search)
 * over a scroll of: the vehicle-fit banner, a "Shop by vehicle" make row
 * with custom car silhouettes, and a colorful "Shop by category" grid with
 * custom part icons. Tiles route to the Make / Category screens.
 */
export default function ExploreScreen() {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const dark = scheme === 'dark';
  // Measured header height; the scroll content is padded by this much so it
  // starts below the frosted panel it scrolls under.
  const [headerHeight, setHeaderHeight] = useState(insets.top + 132);
  const toast = useToast();

  // "Shop by category" grid — the category-tree ROOTS (the 10 systems), same
  // source as the after-brand systems screen, via GET /v1/reference/categories.
  // (The old GET /v1/categories buckets were retired from the tree, which is why
  // the grid collapsed to one tile.) Styled/localized in useSystemCategories.
  const { state: categoriesState, categories, refresh: refreshCategories } = useSystemCategories();
  // Tapping a category DRILLS: root → its subcategories (or straight to parts if
  // it's a leaf), the same behavior as a systems-screen row. No vehicle context
  // on the home grid.
  const { drill } = useCategoryDrill({});
  // "Shop by vehicle" row — live from GET /v1/reference/makes (admin-managed),
  // falling back to the bundled makes on error so it never renders blank.
  const { state: makesState, makes } = useMakes();
  // Unread count drives the red bell indicator — shown only when > 0.
  const { unreadCount } = useNotifications();

  // Pull-to-refresh — a branded wheel bar replaces the stock spinner; on
  // release it refetches the category grid, then confirms with a toast.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refreshCategories().finally(() => {
      setRefreshing(false);
      toast.success(t('explore.pricesStockUpdated'));
    });
  }, [refreshCategories, toast, t]);

  // Drill into the tapped system: its subcategories (or parts if it's a leaf).
  // `drill` already fires the selection haptic and threads no vehicle context.
  const openCategory = useCallback(
    (id: string, label: string) => {
      void drill({ id, name: label });
    },
    [drill],
  );
  const openMake = useCallback(
    (brandId: string) => {
      triggerHaptic('selection');
      // Coming-soon brands are teasers — open a modal instead of navigating to
      // an empty model list.
      const make = makes.find((m) => m.id === brandId);
      if (make?.comingSoon) {
        modalService.openModal('comingSoon', { name: make.name });
        return;
      }
      router.push({ pathname: '/make', params: { make: brandId } });
    },
    [makes],
  );

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
              accessibilityLabel={t('explore.notifications')}
              androidRipple={false}
              center
              style={{ width: 42, height: 42 }}
            >
              <Bell size={21} strokeWidth={2.2} color={tokens.text} />
              {unreadCount > 0 ? (
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
              ) : null}
            </AppPressableView>
          </AppView>

          <AppPressableView
            testID="explore-search-entry"
            onPress={() => router.push('/search')}
            accessibilityRole="search"
            accessibilityLabel={t('explore.searchAccessibility')}
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
              {t('explore.searchPlaceholder')}
            </AppText>
          </AppPressableView>
        </AppView>

        {/* Blended dropline — the panel feathers into the content below. */}
        <HeaderFade color={tokens.background} height={HEADER_FADE} />
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
            {t('explore.refreshing')}
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
            {t('explore.shopByVehicle')}
          </AppText>
          <AppPressableView onPress={() => router.navigate('/garage')} androidRipple={false} accessibilityRole="button">
            <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
              {t('explore.myGarage')}
            </AppText>
          </AppPressableView>
        </AppView>
        {makesState === 'loading' ? (
          <BrandRowSkeleton />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingVertical: 2 }}
            style={{ marginHorizontal: -20 }}
          >
            {makes.map((b) => (
              <VehicleMakeTile
                key={b.id}
                brandId={b.id}
                label={b.name}
                logoUrl={b.logoUrl}
                comingSoon={b.comingSoon}
                onPress={openMake}
              />
            ))}
          </ScrollView>
        )}

        {/* ── MATOR Certified ── */}
        <CertifiedSection />

        {/* ── Shop by category ── */}
        <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text, marginTop: 6 }}>
          {t('explore.shopByCategory')}
        </AppText>
        {categoriesState === 'loading' ? (
          <CategoryGridSkeleton />
        ) : (
          <AppView row wrap justify="space-between" style={{ rowGap: 12 }}>
            {categories.map((c) => (
              <CategoryTile
                key={c.id}
                name={c.name}
                iconKey={c.iconKey}
                count={c.count}
                onPress={() => openCategory(c.id, c.name)}
              />
            ))}
          </AppView>
        )}
      </ScrollView>
    </AppView>
  );
}
