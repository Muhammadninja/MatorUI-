import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AutoPartIcon from '@/components/screens-components/catalog/auto-part-icon';
import { CategoryRowsSkeleton } from '@/components/screens-components/catalog/category-grid-skeleton';
import FitmentNote from '@/components/screens-components/catalog/fitment-note';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { useSystemCategories } from '@/hooks/use-system-categories';
import { useCategoryDrill } from '@/hooks/use-category-drill';
import type { CategoryTileData } from '@/services/categories-service';

/**
 * Catalog (Stage 2) — the vehicle-systems landing. Reached from Explore
 * ("Browse by system") or a make → model selection (which passes `make`/`model`).
 *
 * The systems list is the category-tree ROOTS (`GET /v1/reference/categories`,
 * via `useSystemCategories`) — Brake System, Engine, Heating & Cooling… — the
 * same nodes an admin manages in the categories console and the subcategory seed
 * hangs under. Tapping a system DRILLS into its admin-defined subcategories (or
 * straight to parts if it's a leaf), carrying the make/model context through.
 */
export default function CatalogSystemsScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { make, model, brandId } = useLocalSearchParams<{
    make?: string;
    model?: string;
    brandId?: string;
  }>();
  const vehicleLabel = [make, model].filter(Boolean).join(' ');
  const { state, categories } = useSystemCategories();

  // Tapping a system now DRILLS: if the admin gave it subcategories (e.g.
  // Heating & Cooling → Antifreeze, Radiators…), show those first; a leaf system
  // opens its parts directly, exactly as before. Vehicle context flows through.
  const { drill, resolvingId } = useCategoryDrill({ make, model, brandId });

  // Once a model is chosen the row is vehicle-scoped, so drop the category icon
  // and let the (now larger) system name lead.
  const hideIcon = Boolean(vehicleLabel);

  const renderItem = useCallback(
    ({ item }: { item: CategoryTileData }) => (
      <AppPressableView
        onPress={() => void drill(item)}
        disabled={resolvingId != null}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        row
        align="center"
        gap={14}
        style={{ paddingVertical: 16, opacity: resolvingId && resolvingId !== item.id ? 0.5 : 1 }}
      >
        {hideIcon ? null : (
          <AppView
            center
            rounded={12}
            style={{ width: 44, height: 44, backgroundColor: tokens.backgroundSecondary }}
          >
            <AutoPartIcon name={item.name} iconKey={item.iconKey} size={26} />
          </AppView>
        )}
        <AppView flex={1}>
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
            {item.label}
          </AppText>
        </AppView>
        {resolvingId === item.id ? (
          <WheelLoader size={18} color={tokens.textMuted} />
        ) : (
          <ChevronRight size={22} strokeWidth={1.5} color={tokens.text} />
        )}
      </AppPressableView>
    ),
    [drill, resolvingId, tokens, hideIcon],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title={vehicleLabel || t('catalog.catalogTitle')}
        fallbackHref="/explore"
      />
      <FlashList
        testID="systems-grid"
        data={categories}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <AppView gap={6} style={{ paddingBottom: 12 }}>
            <AppText
              family="accent"
              weight="bold"
              style={{
                fontSize: 12,
                color: tokens.textMuted,
                textTransform: 'uppercase',
                letterSpacing: 0.7,
              }}
            >
              {t('catalog.shopBySystem')}
            </AppText>
            {/* Replaces the fitment bar: the car is named in the section's own
                subtitle, and the span taps through to the Garage. */}
            <FitmentNote />
          </AppView>
        }
        ItemSeparatorComponent={() => (
          <AppView style={{ height: 1, backgroundColor: tokens.divider }} />
        )}
        ListEmptyComponent={state === 'loading' ? <CategoryRowsSkeleton /> : null}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom + 24, 40),
        }}
        showsVerticalScrollIndicator={false}
      />
    </AppView>
  );
}
