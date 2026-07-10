import { useCallback } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';

import ProductCard from '@/components/screens-components/home/product-card';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppView } from '@/components/shared/app-view';
import { MATOR_PRODUCTS, type MatorProduct } from '@/mocks/mator-catalog';

/**
 * Recently Viewed — faithful rebuild of the prototype's `scRecent`.
 *
 * Prototype: `const items = this.products.slice(2, 8)` → products[2..7]
 * Layout: header (back + "Recently viewed") + 2-col grid of ProductCard.
 */

// Prototype uses `products.slice(2, 8)` — zero-indexed entries 2 through 7.
const RECENT_ITEMS: MatorProduct[] = MATOR_PRODUCTS.slice(2, 8);

export default function RecentlyViewedScreen() {
  const renderItem = useCallback<ListRenderItem<MatorProduct>>(
    ({ item }) => (
      <AppView style={{ flex: 1 }}>
        <ProductCard product={item} />
      </AppView>
    ),
    [],
  );

  const keyExtractor = useCallback((item: MatorProduct) => item.id, []);

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Recently viewed" fallbackHref="/profile" />

      <FlatList<MatorProduct>
        data={RECENT_ITEMS}
        numColumns={2}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 32,
        }}
        columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
        renderItem={renderItem}
      />
    </AppView>
  );
}
