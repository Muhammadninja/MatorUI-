import { router, useLocalSearchParams } from 'expo-router';
import { PackageOpen } from 'lucide-react-native';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProductRow from '@/components/screens-components/catalog/product-row';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { ListLoadingOverlay } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useCatalogList } from '@/hooks/use-catalog-list';
import { useToast } from '@/hooks/use-toast';
import type { CatalogItem } from '@/services/catalog-service';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Category (`category`) — vertical list of product result rows for a category
 * (or a "Make Model" / dealer from Explore). Backed by the **real catalog**
 * (`useCatalogList` → `catalog-service`); no mock fixtures. Shows the
 * vehicle-fit banner, a result count, a branded loading overlay, and a
 * "No results found" empty state when the catalog returns nothing.
 */
export default function CategoryScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ cat?: string; label?: string }>();
  const cat = params.cat ?? 'All';
  const label = params.label ?? cat;

  const { state, items, total, refresh } = useCatalogList({
    page: 1,
    pageSize: 24,
    category: cat && cat !== 'All' ? cat : undefined,
  });

  // Any load failure (offline, timeout, or a server error) degrades to the
  // empty state — a browse screen should never show a scary error card. The
  // empty state keeps a Retry so it isn't a dead-end when the network returns.
  const showEmpty = state === 'empty' || state === 'error';

  const { addItem } = useCartContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  const openItem = (it: CatalogItem) =>
    router.push({ pathname: '/item-detail/[id]', params: { id: it.id } });

  // Guest-first purchase gate, mirroring Item Detail.
  const addToCart = (it: CatalogItem) => {
    if (!isAuthenticated) {
      triggerHaptic('selection');
      router.push('/sign-in?gate=1');
      return;
    }
    triggerHaptic('success');
    addItem({ id: it.id, title: it.title, description: it.description, price: it.price, imageUrl: it.images?.[0] });
    toast.success('Added to cart');
  };

  return (
    <AppView flex={1} colorName="card">
      <AppSettingsHeader title={label} fallbackHref="/explore" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: Math.max(insets.bottom + 24, 40),
          gap: 8,
        }}
      >
        {state === 'success' ? (
          <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
            {total || items.length} result{(total || items.length) === 1 ? '' : 's'}
          </AppText>
        ) : null}

        {showEmpty ? (
          <AppView center py={40} gap={12}>
            <PackageOpen size={30} strokeWidth={2} color={tokens.textMuted} />
            <AppView align="center" gap={4}>
              <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
                No results found
              </AppText>
              <AppText
                family="default"
                style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
              >
                We couldn&apos;t find anything for {label}. Try another category.
              </AppText>
            </AppView>
            <AppButton title="Retry" kind="secondary" size="sm" onPress={refresh} />
          </AppView>
        ) : state === 'success' ? (
          <AppView gap={12}>
            {items.map((it) => (
              <ProductRow key={it.id} item={it} onOpen={openItem} onAdd={addToCart} />
            ))}
          </AppView>
        ) : null}
      </ScrollView>

      <ListLoadingOverlay visible={state === 'loading'} label="Finding parts…" />
    </AppView>
  );
}
