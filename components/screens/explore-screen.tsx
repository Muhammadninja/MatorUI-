import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { Bell, ChevronDown, ChevronUp, Search } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CategoryGridSkeleton, {
  BrandRowSkeleton,
} from '@/components/screens-components/catalog/category-grid-skeleton';
import CategoryTile from '@/components/screens-components/catalog/category-tile';
import VehicleMakeTile from '@/components/screens-components/catalog/vehicle-make-tile';
import HomeGarageCard from '@/components/screens-components/garage/home-garage-card';
import { AppButton } from '@/components/shared/app-button';
import { AppLogo } from '@/components/shared/app-logo';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { useCategories } from '@/hooks/use-categories';
import { useMakes } from '@/hooks/use-vehicle-catalog';
import { useNotifications } from '@/hooks/use-notifications';
import { useToast } from '@/hooks/use-toast';
import { modalService } from '@/services/global-modal-service/global-modal.service';
import { triggerHaptic } from '@/utils/haptics';

// Soft feather under the header so the frosted panel dissolves into the
// content instead of ending in a hard seam ("dropline").
const HEADER_FADE = 12;

// Number of bands in the feather. More = smoother ramp; 8 over 12px (~1.5px
// each) reads as a continuous fade.
const HEADER_FADE_BANDS = 8;

const SCREEN_GUTTER = 16;
const GRID_GAP = 8;
/** Category tiles shown before "show all"; every root stays one tap away. */
const INITIAL_CATEGORY_COUNT = 6;
/** Space left between the frosted header and the category heading after collapsing. */
const CATEGORY_HEADING_CLEARANCE = 12;

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
 * Explore (home) — a **category browser** (not a product list). A frosted
 * sticky header (logo + notifications + search) over a scroll of: the graphite
 * My Garage card, a "Shop by vehicle" make row with brand logos, and a "Shop by
 * category" grid with custom part icons. Make tiles route to the Make screen; a
 * category tile opens every part of its system.
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
  const { width: windowWidth } = useWindowDimensions();
  // Three equal columns with exact gaps, whatever the phone's width.
  const tileWidth = Math.floor((windowWidth - SCREEN_GUTTER * 2 - GRID_GAP * 2) / 3);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const CategoriesChevron = categoriesExpanded ? ChevronUp : ChevronDown;

  // Collapsing removes content the user may be scrolled past, so the offset is
  // corrected once the shorter content has been measured.
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  const categoriesHeadingY = useRef(0);
  const settleAfterCollapse = useRef(false);

  const toggleCategories = useCallback(() => {
    settleAfterCollapse.current = categoriesExpanded;
    setCategoriesExpanded(!categoriesExpanded);
  }, [categoriesExpanded]);

  const onContentSizeChange = useCallback(
    (_width: number, contentHeight: number) => {
      if (!settleAfterCollapse.current) return;
      settleAfterCollapse.current = false;
      const headingOffset =
        categoriesHeadingY.current - headerHeight - HEADER_FADE - CATEGORY_HEADING_CLEARANCE;
      // The shortened page often can't scroll far enough to pin the heading.
      const maxOffset = contentHeight - viewportHeight.current;
      const target = Math.max(0, Math.min(headingOffset, maxOffset));
      if (scrollY.current > target) {
        scrollRef.current?.scrollTo({ y: target, animated: true });
      }
    },
    [headerHeight],
  );

  // "Shop by category" grid — the roots of the category tree with their parts
  // counts, live from GET /v1/reference/categories.
  const { state: categoriesState, categories, refresh: refreshCategories } = useCategories();
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
    // refetch resolves even when the request fails; the result says which.
    void refreshCategories().then((result) => {
      setRefreshing(false);
      if ((result as { isError?: boolean } | undefined)?.isError) {
        toast.danger(t('search.catalogueLoadError'));
      } else {
        toast.success(t('explore.pricesStockUpdated'));
      }
    });
  }, [refreshCategories, toast, t]);

  // A tile lists every part of its system straight away: the backend widens a
  // root id to the root's whole subtree. The subcategory step belongs to the
  // make → model flow (the systems screen), and a car in the Garage doesn't
  // change this grid — it carries no vehicle context.
  const openCategory = useCallback((id: string, label: string) => {
    triggerHaptic('selection');
    router.push({ pathname: '/category', params: { cat: id, label } });
  }, []);
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
        {Platform.OS === 'android' ? (
          // expo-blur can't do real backdrop blur on Android — it renders a
          // flat gray fallback which, under the translucent frosted wash,
          // reads muddy and lets scrolled content bleed through. Use a clean,
          // fully-opaque theme-bg fill instead; the HeaderFade below still
          // feathers it softly into the content (matching AppBlurView).
          <AppView
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: tokens.background }]}
          />
        ) : (
          <>
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
          </>
        )}
        <AppView
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: SCREEN_GUTTER,
            paddingBottom: 12,
            gap: 12,
          }}
        >
          <AppView row align="center" justify="space-between">
            <AppLogo size={26} />
            <AppPressableView
              onPress={() => router.push('/notifications')}
              accessibilityRole="button"
              accessibilityLabel={t('explore.notifications')}
              androidRipple={false}
              center
              style={{ width: 48, height: 48, marginRight: -12 }}
            >
              <Bell size={21} strokeWidth={2.2} color={tokens.text} />
              {unreadCount > 0 ? (
                <AppView
                  style={{
                    position: 'absolute',
                    top: 11,
                    right: 12,
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
            gap={8}
            rounded={12}
            px="lg"
            colorName={dark ? 'backgroundSecondary' : 'surface'}
            borderWidth={1}
            borderName="controlBorder"
            style={{ minHeight: 48 }}
          >
            <Search size={20} strokeWidth={2.2} color={tokens.textMuted} />
            <AppText textVariant="body" colorName="textMuted" style={{ flex: 1 }}>
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
          <WheelLoader size={22} color={tokens.brand} />
          <AppText
            family="accent"
            weight="semibold"
            style={{ fontSize: 13, color: tokens.textMuted }}
          >
            {t('explore.refreshing')}
          </AppText>
        </AppView>
      ) : null}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={(e) => {
          viewportHeight.current = e.nativeEvent.layout.height;
        }}
        onContentSizeChange={onContentSizeChange}
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
          paddingTop: headerHeight + HEADER_FADE,
          paddingHorizontal: SCREEN_GUTTER,
          paddingBottom: 32,
          gap: 12,
        }}
      >
        <HomeGarageCard />

        {/* ── Shop by vehicle ── */}
        <AppText textVariant="h4" weight="bold" style={{ marginTop: 12 }}>
          {t('explore.shopByVehicle')}
        </AppText>
        {makesState === 'loading' ? (
          <BrandRowSkeleton />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: GRID_GAP,
              paddingHorizontal: SCREEN_GUTTER,
              paddingVertical: 2,
            }}
            style={{ marginHorizontal: -SCREEN_GUTTER }}
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

        {/* ── Shop by category ── */}
        <AppText
          textVariant="h4"
          weight="bold"
          style={{ marginTop: 12 }}
          onLayout={(e) => {
            categoriesHeadingY.current = e.nativeEvent.layout.y;
          }}
        >
          {t('explore.shopByCategory')}
        </AppText>
        {categoriesState === 'loading' ? (
          <CategoryGridSkeleton count={INITIAL_CATEGORY_COUNT} tileWidth={tileWidth} />
        ) : categoriesState === 'error' ? (
          <AppView align="center" gap={10} style={{ paddingVertical: 12 }}>
            <AppText
              family="default"
              style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center' }}
            >
              {t('search.catalogueLoadError')}
            </AppText>
            <AppButton
              title={t('common.retry')}
              kind="secondary"
              size="sm"
              onPress={() => void refreshCategories()}
            />
          </AppView>
        ) : (
          <>
            <AppView row wrap gap={GRID_GAP}>
              {(categoriesExpanded ? categories : categories.slice(0, INITIAL_CATEGORY_COUNT)).map(
                (c) => (
                  <CategoryTile
                    key={c.id}
                    name={c.name}
                    label={c.label}
                    iconKey={c.iconKey}
                    count={c.count}
                    width={tileWidth}
                    onPress={() => openCategory(c.id, c.label)}
                  />
                ),
              )}
            </AppView>
            {categories.length > INITIAL_CATEGORY_COUNT ? (
              <AppPressableView
                testID="explore-toggle-categories"
                onPress={toggleCategories}
                accessibilityRole="button"
                accessibilityLabel={t(
                  categoriesExpanded ? 'explore.showFewerCategories' : 'explore.showAllCategories',
                )}
                accessibilityState={{ expanded: categoriesExpanded }}
                androidRipple={false}
                style={{ alignSelf: 'center' }}
              >
                {/* minHeight sits inside the Pressable: on the pressable's own
                 *  style it would reach only the wrapper, not the touch area. */}
                <AppView row center gap={4} style={{ minHeight: 48, paddingHorizontal: 12 }}>
                  <AppText
                    weight="medium"
                    style={{ fontSize: 15, lineHeight: 20, color: tokens.brand }}
                  >
                    {t(categoriesExpanded ? 'explore.collapseCategories' : 'explore.allCategories')}
                  </AppText>
                  <CategoriesChevron size={18} strokeWidth={2.2} color={tokens.brand} />
                </AppView>
              </AppPressableView>
            ) : null}
          </>
        )}
      </ScrollView>
    </AppView>
  );
}
