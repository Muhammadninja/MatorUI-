import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MasterSystemRow from '@/components/screens-components/catalog/master-system-row';
import VehicleContextBar from '@/components/screens-components/catalog/vehicle-context-bar';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { CATALOG_SYSTEMS, type CatalogSystem } from '@/constants/catalog-systems';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Catalog (Stage 2) — the core vehicle-systems landing. Reached either from
 * Explore ("Browse by system") or from a make → model selection (which passes
 * `make`/`model`). A vehicle context bar over a FlashList of the 8 Master
 * Systems; tapping a system routes to the parts list, carrying the system +
 * the make/model context.
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

  const openSystem = useCallback(
    (system: CatalogSystem) => {
      triggerHaptic('selection');
      router.push({
        pathname: '/catalog/parts',
        params: { systemId: system.id, make, model, brandId },
      });
    },
    [make, model, brandId],
  );

  const renderItem = useCallback(
    ({ item }: { item: CatalogSystem }) => <MasterSystemRow system={item} onPress={openSystem} />,
    [openSystem],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={vehicleLabel || 'Catalog'} fallbackHref="/explore" />
      <FlashList
        data={CATALOG_SYSTEMS}
        keyExtractor={(s) => s.id}
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: Math.max(insets.bottom + 24, 40) }}
        showsVerticalScrollIndicator={false}
      />
    </AppView>
  );
}
