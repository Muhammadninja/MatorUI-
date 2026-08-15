import { router, useLocalSearchParams } from 'expo-router';
import { PackageOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProductRow from '@/components/screens-components/catalog/product-row';
import { RADIUS_PILL } from '@/components/screens-components/search/radii';
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
import { openItemDetail } from '@/utils/nav';

/**
 * Category (`category`) — vertical list of product result rows for a category
 * (or a "Make Model" / dealer from Explore). Backed by the **real catalog**
 * (`useCatalogList` → `catalog-service`); no mock fixtures. Shows the
 * vehicle-fit banner, a result count, a branded loading overlay, and a
 * "No results found" empty state when the catalog returns nothing.
 */
export default function CategoryScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ cat?: string; label?: string }>();
  const cat = params.cat ?? 'All';
  const label = params.label ?? cat;

  const { state, items, total } = useCatalogList({
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

  const openItem = (it: CatalogItem) => openItemDetail(it.id);

  // Guest-first purchase gate, mirroring Item Detail.
  const addToCart = (it: CatalogItem) => {
    if (!isAuthenticated) {
      triggerHaptic('selection');
      router.push('/sign-in?gate=1');
      return;
    }
    triggerHaptic('success');
    addItem({ id: it.id, title: it.title, description: it.description, price: it.price, imageUrl: it.images?.[0] });
    toast.success(t('catalog.addedToCart'));
  };

  return (
    <AppView flex={1}>
      <AppSettingsHeader title={label} fallbackHref="/explore" />
      {showEmpty ? (
        // Minimal centered empty state — icon medallion + "No parts found".
        // Offset the centered region by the bottom tab bar (+ safe area) so
        // the content reads as visually centered in the space ABOVE the bar,
        // not pushed low behind it.
        <AppView
          flex={1}
          px={20}
          justify="center"
          align="center"
          gap={16}
          style={{ paddingBottom: insets.bottom + 72 }}
        >
          <AppView
            center
            rounded={RADIUS_PILL}
            colorName="backgroundSecondary"
            borderName="border"
            borderWidth={1}
            style={{ width: 72, height: 72 }}
          >
            <PackageOpen size={28} strokeWidth={2} color={tokens.text} />
          </AppView>
          <AppText textVariant="title" family="heading" colorName="text" align="center">
            {t('catalog.noPartsFound')}
          </AppText>
        </AppView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 0,
            paddingBottom: Math.max(insets.bottom + 24, 40),
            paddingHorizontal: 16,
            gap: 8,
          }}
        >
          {state === 'success' ? (
            <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
              {t('catalog.resultCount', { count: total || items.length })}
            </AppText>
          ) : null}

          {state === 'success' ? (
            <AppView gap={14}>
              {items.map((it) => (
                <ProductRow key={it.id} item={it} onOpen={openItem} onAdd={addToCart} />
              ))}
            </AppView>
          ) : null}
        </ScrollView>
      )}

      <ListLoadingOverlay visible={state === 'loading'} label={t('catalog.findingParts')} />
    </AppView>
  );
}
