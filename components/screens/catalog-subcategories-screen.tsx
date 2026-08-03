import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryRowsSkeleton } from '@/components/screens-components/catalog/category-grid-skeleton';
import VehicleContextBar from '@/components/screens-components/catalog/vehicle-context-bar';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { useCategoryDrill } from '@/hooks/use-category-drill';
import { fetchReferenceCategories, type RefCategory } from '@/services/reference-catalog';

type LoadState = 'loading' | 'error' | 'loaded';

/**
 * Catalog subcategories — the drill level between a system and its parts. Lists
 * the ACTIVE children an admin created under the chosen node (e.g. Heating &
 * Cooling → Antifreeze, Radiators…), from `GET /v1/reference/categories`. Tapping
 * a child drills again if it too has children, else opens its parts list. Reached
 * only when the parent actually has children; if it somehow renders empty, we
 * offer "View all parts" so the buyer is never dead-ended.
 */
export default function CatalogSubcategoriesScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { parentId, parentLabel, make, model, brandId } = useLocalSearchParams<{
    parentId?: string;
    parentLabel?: string;
    make?: string;
    model?: string;
    brandId?: string;
  }>();

  const [state, setState] = useState<LoadState>('loading');
  const [items, setItems] = useState<RefCategory[]>([]);
  const { drill, resolvingId } = useCategoryDrill({ make, model, brandId });

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!parentId) {
        setItems([]);
        setState('loaded');
        return;
      }
      setState('loading');
      fetchReferenceCategories(parentId, signal)
        .then((rows) => {
          setItems(rows);
          setState('loaded');
        })
        .catch(() => setState('error'));
    },
    [parentId],
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  // Fallback when this node turns out to have no children — jump to its parts.
  const viewAllParts = useCallback(() => {
    router.replace({
      pathname: '/catalog/parts',
      params: { categoryId: parentId, categoryLabel: parentLabel, make, model, brandId },
    });
  }, [parentId, parentLabel, make, model, brandId]);

  const renderItem = useCallback(
    ({ item }: { item: RefCategory }) => (
      <AppPressableView
        onPress={() => void drill(item)}
        disabled={resolvingId != null}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        row
        align="center"
        gap={14}
        style={{ paddingVertical: 16, opacity: resolvingId && resolvingId !== item.id ? 0.5 : 1 }}
      >
        <AppView flex={1}>
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
            {item.name}
          </AppText>
        </AppView>
        {resolvingId === item.id ? (
          <WheelLoader size={18} color={tokens.textMuted} />
        ) : (
          <ChevronRight size={22} strokeWidth={1.5} color={tokens.text} />
        )}
      </AppPressableView>
    ),
    [drill, resolvingId, tokens],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={parentLabel || 'Categories'} fallbackHref="/explore" />

      {state === 'error' ? (
        <AppView flex={1} center px="xl" gap={12}>
          <AlertCircle size={30} strokeWidth={2} color={tokens.error} />
          <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center' }}>
            Couldn&apos;t load subcategories.
          </AppText>
          <AppButton title="Retry" kind="brand" size="sm" onPress={() => load()} />
          <AppButton title={`View all ${parentLabel ?? ''} parts`.trim()} kind="secondary" variant="outline" size="sm" onPress={viewAllParts} />
        </AppView>
      ) : state === 'loaded' && items.length === 0 ? (
        <AppView flex={1} center px="xl" gap={12}>
          <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
            No subcategories
          </AppText>
          <AppButton title={`View all ${parentLabel ?? ''} parts`.trim()} kind="brand" size="md" onPress={viewAllParts} />
        </AppView>
      ) : (
        <FlashList
          testID="subcategories-list"
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <AppView gap={12} style={{ paddingBottom: 12 }}>
              <VehicleContextBar />
              <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                {parentLabel ? `${parentLabel} · categories` : 'Categories'}
              </AppText>
            </AppView>
          }
          ItemSeparatorComponent={() => <AppView style={{ height: 1, backgroundColor: tokens.divider }} />}
          ListEmptyComponent={state === 'loading' ? <CategoryRowsSkeleton /> : null}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: Math.max(insets.bottom + 24, 40) }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </AppView>
  );
}
