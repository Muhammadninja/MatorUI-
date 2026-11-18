import { router } from 'expo-router';
import { AlertCircle, Heart } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import ProductRow, {
  productCellStyle,
  useProductGridColumns,
} from '@/components/screens-components/catalog/product-row';
import AppList from '@/components/shared/app-list';
import { AppButton } from '@/components/shared/app-button';
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
import { openItemDetail } from '@/utils/nav';

/**
 * Liked — the user's favorited parts. Like state is stored locally
 * (`LikesContext`); the product data is hydrated live from the catalog
 * backend (`useLikedProducts`). Rows reuse the shared `ProductRow`. Shows an
 * empty state until the user hearts something.
 */
export default function LikedScreen() {
  const { t } = useTranslation();
  const columns = useProductGridColumns();
  const { tokens } = useThemeContext();
  const { state, items, refresh } = useLikedProducts();
  const { addItem } = useCartContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  const openItem = useCallback((it: CatalogItem) => openItemDetail(it.id), []);

  const addToCart = useCallback(
    (it: CatalogItem) => {
      if (!isAuthenticated) {
        triggerHaptic('selection');
        router.push('/sign-in?gate=1');
        return;
      }
      triggerHaptic('success');
      addItem({ id: it.id, title: it.title, description: it.description, price: it.price, imageUrl: it.images?.[0] });
      toast.success(t('liked.addedToCart'));
    },
    [addItem, isAuthenticated, toast, t],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: CatalogItem; index: number }) => (
      <AppView style={productCellStyle(index, columns)}>
        <ProductRow item={item} onOpen={openItem} onAdd={addToCart} />
      </AppView>
    ),
    [openItem, addToCart, columns],
  );

  return (
    <AppView flex={1} colorName="background" testID="liked-screen">
      <AppSettingsHeader title={t('liked.title')} fallbackHref="/profile" />

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={26} color={tokens.textMuted} />
        </AppView>
      ) : state === 'error' ? (
        <AppView testID="liked-error" flex={1} center px="xl" gap={12} style={{ paddingBottom: 72 }}>
          <AppView
            center
            rounded={999}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 72, height: 72, backgroundColor: tokens.brandSoft }}
          >
            <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
          </AppView>
          <AppView align="center" gap={4}>
            <AppText textVariant="h4" weight="bold" align="center" colorName="text">
              {t('liked.loadErrorTitle')}
            </AppText>
            <AppText
              family="default"
              colorName="textMuted"
              style={{ fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 280 }}
            >
              {t('liked.loadErrorBody')}
            </AppText>
          </AppView>
          <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={() => { void refresh(); }} />
        </AppView>
      ) : state === 'empty' ? (
        <AppView testID="liked-empty" flex={1} center px="xl" gap={12} style={{ paddingBottom: 72 }}>
          <AppView
            center
            rounded={999}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 72, height: 72, backgroundColor: tokens.brandSoft }}
          >
            <Heart size={32} strokeWidth={2} color={tokens.brand} />
          </AppView>
          <AppView align="center" gap={4}>
            <AppText textVariant="h4" weight="bold" align="center" colorName="text">
              {t('liked.emptyTitle')}
            </AppText>
            <AppText
              family="default"
              colorName="textMuted"
              style={{ fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 280 }}
            >
              {t('liked.emptyBody')}
            </AppText>
          </AppView>
        </AppView>
      ) : (
        <AppList<CatalogItem>
          data={items}
          keyExtractor={(it) => it.id}
          showsVerticalScrollIndicator={false}
          numColumns={columns}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
          renderItem={renderItem}
        />
      )}
    </AppView>
  );
}
