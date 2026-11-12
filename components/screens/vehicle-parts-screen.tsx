import { router, useLocalSearchParams } from 'expo-router';
import { PackageOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProductRow, {
  productCellStyle,
  useProductGridColumns,
} from '@/components/screens-components/catalog/product-row';
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
 * Vehicle parts / bestsellers — the "Shop parts that fit" destination from the
 * garage active-vehicle hero. Lists the parts that fit a specific vehicle,
 * filtered by the active car's `make`/`model` (server-side fit params on
 * `GET /v1/catalog/parts`). Tapping a row opens Item Detail in the same
 * (explore) stack; add-to-cart is guest-gated like every other list.
 *
 * The sales-ranked **bestsellers** ordering is a backend feature to add (see
 * `docs/API_CONTRACT.md` §Vehicle bestsellers). Until it ships, the list uses
 * the catalog's default order; flip `sortBy` to `'bestsellers'` once live.
 */
export default function VehiclePartsScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const columns = useProductGridColumns();
  const params = useLocalSearchParams<{
    make?: string;
    model?: string;
    year?: string;
    label?: string;
  }>();

  const make = params.make?.trim() || undefined;
  const model = params.model?.trim() || undefined;
  const vehicleName = [params.year, make, model].filter(Boolean).join(' ').trim();
  const title =
    params.label?.trim() ||
    [make, model].filter(Boolean).join(' ') ||
    t('vehicleParts.fallbackTitle');

  const { state, items, total } = useCatalogList({
    page: 1,
    pageSize: 24,
    make,
    model,
    // Sales-ranked fitment list — the backend implements `sort=bestseller`
    // (isBestseller → salesCount → reviewCount → rating → newest) with make/model
    // fit filtering, so this is genuinely "top parts bought for this car".
    sortBy: 'bestseller',
  });

  // Any load failure (offline / timeout / server error) degrades to the empty
  // state — a browse screen should never show a scary error card.
  const showEmpty = state === 'empty' || state === 'error';

  const { addItem } = useCartContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  const openItem = (it: CatalogItem) => openItemDetail(it.id);

  // Guest-first purchase gate, mirroring Item Detail / Category.
  const addToCart = (it: CatalogItem) => {
    if (!isAuthenticated) {
      triggerHaptic('selection');
      router.push('/sign-in?gate=1');
      return;
    }
    triggerHaptic('success');
    addItem({
      id: it.id,
      title: it.title,
      description: it.description,
      price: it.price,
      imageUrl: it.images?.[0],
    });
    toast.success(t('catalog.addedToCart'));
  };

  return (
    <AppView flex={1}>
      <AppSettingsHeader title={title} fallbackHref="/explore" />
      {showEmpty ? (
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
          <AppText
            family="default"
            align="center"
            style={{ fontSize: 13, color: tokens.textMuted, maxWidth: 300 }}
          >
            {t('vehicleParts.emptyBody', { vehicle: vehicleName || title })}
          </AppText>
        </AppView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom + 24, 40),
            gap: 8,
          }}
        >
          {/* Rows run edge to edge, so the section copy carries its own inset. */}
          <AppView px={16} gap={8}>
            {/* The list is scoped to the model; each part's own badge says whether
             *  it is confirmed for this car. */}
            {model ? (
              <AppView
                testID="vehicle-parts-model-chip"
                row
                align="center"
                accessible
                accessibilityLabel={t('vehicleParts.forMyModelA11y', { model: [make, model].filter(Boolean).join(' ') })}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: RADIUS_PILL,
                  backgroundColor: tokens.brandSoft,
                }}
              >
                <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.brandText }}>
                  {t('vehicleParts.forMyModel')} · {model}
                </AppText>
              </AppView>
            ) : null}
            <AppText
              family="accent"
              weight="bold"
              transform="uppercase"
              style={{ fontSize: 11, letterSpacing: 0.8, color: tokens.textMuted }}
            >
              {t('vehicleParts.bestsellers')}
            </AppText>

            {state === 'success' ? (
              <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
                {t('catalog.resultCount', { count: total || items.length })}
              </AppText>
            ) : null}
          </AppView>

          {state === 'success' ? (
            <AppView row wrap style={{ marginTop: 4 }}>
              {items.map((it, i) => (
                <AppView key={it.id} style={{ width: `${100 / columns}%` }}>
                  <AppView style={productCellStyle(i, columns)}>
                    <ProductRow item={it} onOpen={openItem} onAdd={addToCart} />
                  </AppView>
                </AppView>
              ))}
            </AppView>
          ) : null}
        </ScrollView>
      )}

      <ListLoadingOverlay visible={state === 'loading'} label={t('catalog.findingParts')} />
    </AppView>
  );
}
