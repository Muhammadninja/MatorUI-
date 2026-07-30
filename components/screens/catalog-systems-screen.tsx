import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AutoPartIcon from '@/components/screens-components/catalog/auto-part-icon';
import { CategoryRowsSkeleton } from '@/components/screens-components/catalog/category-grid-skeleton';
import VehicleContextBar from '@/components/screens-components/catalog/vehicle-context-bar';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useCategories } from '@/hooks/use-categories';
import type { CategoryTileData } from '@/services/categories-service';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Catalog (Stage 2) — the vehicle-systems landing. Reached from Explore
 * ("Browse by system") or a make → model selection (which passes `make`/`model`).
 *
 * The systems list is the SAME taxonomy as the "Shop by category" grid — both
 * come from `GET /v1/categories` (via `useCategories`) — so the id a seller
 * tags a part with is exactly what a tap sends to `/v1/catalog/parts?category=`.
 * Tapping a system carries the backend category **id** + label plus the
 * make/model context to the parts list.
 */
export default function CatalogSystemsScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { make, model, brandId } = useLocalSearchParams<{
    make?: string;
    model?: string;
    brandId?: string;
  }>();
  const vehicleLabel = [make, model].filter(Boolean).join(' ');
  const { state, categories } = useCategories();

  const openSystem = useCallback(
    (category: CategoryTileData) => {
      triggerHaptic('selection');
      router.push({
        pathname: '/catalog/parts',
        params: { categoryId: category.id, categoryLabel: category.name, make, model, brandId },
      });
    },
    [make, model, brandId],
  );

  // Once a model is chosen the row is vehicle-scoped, so drop the category icon
  // and let the (now larger) system name lead.
  const hideIcon = Boolean(vehicleLabel);

  const renderItem = useCallback(
    ({ item }: { item: CategoryTileData }) => (
      <AppPressableView
        onPress={() => openSystem(item)}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        row
        align="center"
        gap={14}
        style={{ paddingVertical: 16 }}
      >
        {hideIcon ? null : (
          <AppView center rounded={12} style={{ width: 44, height: 44, backgroundColor: tokens.backgroundSecondary }}>
            <AutoPartIcon name={item.name} iconKey={item.iconKey} size={26} />
          </AppView>
        )}
        <AppView flex={1}>
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
            {item.name}
          </AppText>
        </AppView>
        <ChevronRight size={22} strokeWidth={1.5} color={tokens.text} />
      </AppPressableView>
    ),
    [openSystem, tokens, hideIcon],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={vehicleLabel || 'Catalog'} fallbackHref="/explore" />
      <FlashList
        testID="systems-grid"
        data={categories}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <AppView gap={12} style={{ paddingBottom: 12 }}>
            {vehicleLabel ? null : <VehicleContextBar />}
            <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>
              {vehicleLabel ? `Systems for ${vehicleLabel}` : 'Shop by system'}
            </AppText>
          </AppView>
        }
        ItemSeparatorComponent={() => <AppView style={{ height: 1, backgroundColor: tokens.divider }} />}
        ListEmptyComponent={state === 'loading' ? <CategoryRowsSkeleton /> : null}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: Math.max(insets.bottom + 24, 40) }}
        showsVerticalScrollIndicator={false}
      />
    </AppView>
  );
}
