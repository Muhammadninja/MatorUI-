import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useCallback } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';

import ProductRow from '@/components/screens-components/catalog/product-row';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useLikedProducts } from '@/hooks/use-liked-products';
import { useToast } from '@/hooks/use-toast';
import type { CatalogItem } from '@/services/catalog-service';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Liked — the user's favorited parts. Like state is stored locally
 * (`LikesContext`); the product data is hydrated live from the catalog
 * backend (`useLikedProducts`). Rows reuse the shared `ProductRow`. Shows an
 * empty state until the user hearts something.
 */
export default function LikedScreen() {
  const { tokens } = useThemeContext();
  const { state, items } = useLikedProducts();
  const { addItem } = useCartContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  const openItem = useCallback(
    (it: CatalogItem) => router.push({ pathname: '/item-detail/[id]', params: { id: it.id } }),
    [],
  );

  const addToCart = useCallback(
    (it: CatalogItem) => {
      if (!isAuthenticated) {
        triggerHaptic('selection');
        router.push('/sign-in?gate=1');
        return;
      }
      triggerHaptic('success');
      addItem({ id: it.id, title: it.title, description: it.description, price: it.price, imageUrl: it.images?.[0] });
      toast.success('Added to cart');
    },
    [addItem, isAuthenticated, toast],
  );

  const renderItem = useCallback<ListRenderItem<CatalogItem>>(
    ({ item }) => <ProductRow item={item} onOpen={openItem} onAdd={addToCart} />,
    [openItem, addToCart],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Liked" fallbackHref="/profile" />

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={26} color={tokens.textMuted} />
        </AppView>
      ) : state === 'empty' || state === 'error' ? (
        <AppView flex={1} center px="xl" gap={12}>
          <Heart size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppView align="center" gap={4}>
            <AppText family="heading" colorName="text" style={{ fontSize: 17, lineHeight: 22 }}>
              No liked parts yet
            </AppText>
            <AppText
              family="default"
              colorName="textMuted"
              style={{ fontSize: 13, lineHeight: 18, textAlign: 'center', maxWidth: 280 }}
            >
              Tap the heart on any part to save it here.
            </AppText>
          </AppView>
        </AppView>
      ) : (
        <FlatList<CatalogItem>
          data={items}
          keyExtractor={(it) => it.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32, gap: 14, paddingHorizontal: 16 }}
          renderItem={renderItem}
        />
      )}
    </AppView>
  );
}
