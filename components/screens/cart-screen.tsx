import { router } from 'expo-router';
import { AlertCircle, Package, ShoppingBag, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ImageBox from '@/components/screens-components/home/image-box';
import { AppButton } from '@/components/shared/app-button';
import { AppQtyStepper } from '@/components/shared/app-qty-stepper';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { parsePrice } from '@/services/cart-math';

/**
 * Cart — faithful rebuild of the prototype's `scCart`, now on the real
 * transport-abstracted cart context (`useCartContext`): line items (84px
 * thumb, title, line price, 30px stepper, ✕ remove) and a sticky Subtotal /
 * Est. tax / Total footer + auth-gated Checkout.
 *
 * Quantity mutations and removal are optimistic; a row mid-flight to the
 * transport is greyed via `pendingIds`. State flips to the live backend the
 * moment `EXPO_PUBLIC_API_BASE_URL` is set — no code change here.
 */
export default function CartScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useUserContext();
  const {
    items,
    itemCount,
    totals,
    incrementItem,
    decrementItem,
    removeItem,
    formatCurrency,
    pendingIds,
    isHydrated,
    error,
    refresh,
  } = useCartContext();

  // Guests can browse the cart freely; auth is only required to check out. The
  // phone-auth bottom sheet is presented on the "Proceed to checkout" tap below.
  const goCheckout = () => {
    if (!isAuthenticated) {
      router.push('/sign-in');
      return;
    }
    router.push('/checkout');
  };

  // While the cart is still loading from the backend, don't flash the empty
  // state. Show a branded loader, or an error + retry if the fetch failed.
  if (!isHydrated) {
    return (
      <AppView flex={1} colorName="background" style={{ paddingTop: insets.top + 8 }}>
        <AppText family="heading" colorName="text" style={{ fontSize: 26, lineHeight: 32, paddingHorizontal: 20, paddingTop: 6 }}>
          {t('cart.title')}
        </AppText>
        <AppView flex={1} center gap={14} px="xl">
          {error ? (
            <>
              <AlertCircle size={30} strokeWidth={2} color={tokens.error} />
              <AppText family="heading" colorName="text" style={{ fontSize: 18, lineHeight: 24 }}>
                {t('cart.loadErrorTitle')}
              </AppText>
              <AppText family="default" colorName="textMuted" style={{ fontSize: 13, lineHeight: 18, textAlign: 'center', maxWidth: 280 }}>
                {error}
              </AppText>
              <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={refresh} />
            </>
          ) : (
            <WheelLoader size={30} color={tokens.text} />
          )}
        </AppView>
      </AppView>
    );
  }

  if (items.length === 0) {
    return (
      <AppView flex={1} colorName="background" testID="cart-screen" style={{ paddingTop: insets.top + 8 }}>
        <AppText family="heading" colorName="text" style={{ fontSize: 26, lineHeight: 32, paddingHorizontal: 20, paddingTop: 6 }}>
          {t('cart.title')}
        </AppText>
        <AppView flex={1} center gap={14} px="xl">
          <AppView center rounded={999} style={{ width: 72, height: 72, backgroundColor: tokens.backgroundSecondary }}>
            <ShoppingBag size={30} strokeWidth={1.8} color={tokens.textMuted} />
          </AppView>
          <AppText family="heading" colorName="text" style={{ fontSize: 20, lineHeight: 26 }}>{t('cart.emptyTitle')}</AppText>
          <AppText family="default" colorName="textMuted" style={{ fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 280 }}>
            {t('cart.emptySubtitle')}
          </AppText>
          <AppButton title={t('cart.startShopping')} kind="brand" size="md" onPress={() => router.navigate('/explore')} />
        </AppView>
      </AppView>
    );
  }

  return (
    <AppView flex={1} colorName="background" testID="cart-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} tintColor={tokens.textMuted} colors={[tokens.brandBg]} />
        }
      >
        <AppText family="heading" weight="bold" style={{ fontSize: 26, lineHeight: 32, color: tokens.text, paddingTop: 6 }}>
          {t('cart.titleWithCount', { count: itemCount })}
        </AppText>

        {error ? (
          <AppView row align="center" gap={8}>
            <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
            <AppText family="default" style={{ fontSize: 12.5, color: tokens.error }}>{error}</AppText>
          </AppView>
        ) : null}

        {items.map((item) => {
          const pending = pendingIds.has(item.id);
          return (
            <AppView
              key={item.id}
              testID={`cart-item-${item.id}`}
              row
              gap={12}
              rounded={16}
              p={12}
              colorName="card"
              borderWidth={1}
              borderName="border"
              style={{ opacity: pending ? 0.55 : 1 }}
            >
              <AppView style={{ width: 84 }}>
                {item.sourced && !item.imageUrl ? (
                  // Sourced offer with no dealer photo → a clean icon tile, not
                  // the misleading catalog stand-in image.
                  <AppView
                    center
                    style={{ width: 84, height: 84, borderRadius: 11, backgroundColor: tokens.brandSoft }}
                  >
                    <Package size={30} strokeWidth={1.7} color={tokens.textMuted} />
                  </AppView>
                ) : (
                  <ImageBox label={item.title} uri={item.imageUrl} height={84} radius={11} small />
                )}
              </AppView>
              <AppView flex={1}>
                <AppText family="default" weight="semibold" numberOfLines={2} style={{ fontSize: 14, lineHeight: 18, color: tokens.text }}>
                  {item.title}
                </AppText>
                {item.badge ? (
                  <AppText family="accent" weight="semibold" style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 4 }}>
                    {item.badge}
                  </AppText>
                ) : null}
                <AppView row align="center" justify="space-between" style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
                    {formatCurrency(parsePrice(item.price) * item.quantity)}
                  </AppText>
                  <AppQtyStepper
                    testID={`cart-qty-${item.id}`}
                    value={item.quantity}
                    onIncrement={() => incrementItem(item.id)}
                    onDecrement={() => decrementItem(item.id)}
                    size="sm"
                  />
                </AppView>
              </AppView>
              <AppPressableView
                onPress={() => removeItem(item.id)}
                testID={`cart-remove-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={t('cart.removeItem', { title: item.title })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ alignSelf: 'flex-start' }}
              >
                <X size={16} strokeWidth={2.2} color={tokens.textMuted} />
              </AppPressableView>
            </AppView>
          );
        })}
      </ScrollView>

      {/* Sticky footer */}
      <AppView colorName="background" px="lg" style={{ paddingTop: 16, paddingBottom: Math.max(insets.bottom, 20), borderTopWidth: 1, borderTopColor: tokens.divider }}>
        <SummaryRow label={t('cart.subtotal')} value={formatCurrency(totals.subtotal)} tokens={tokens} />
        {totals.discount > 0 ? (
          <SummaryRow label={t('cart.discount')} value={`−${formatCurrency(totals.discount)}`} tokens={tokens} />
        ) : null}
        <SummaryRow label={t('cart.estTax')} value={formatCurrency(totals.tax)} tokens={tokens} />
        <AppView row justify="space-between" style={{ marginBottom: 12 }}>
          <AppText family="accent" weight="bold" style={{ fontSize: 16, color: tokens.text }}>{t('cart.total')}</AppText>
          <AppText family="heading" weight="bold" style={{ fontSize: 20, color: tokens.text }}>{formatCurrency(totals.total)}</AppText>
        </AppView>
        <AppButton testID="cart-checkout-btn" title={t('cart.checkout')} kind="brand" size="lg" fullWidth onPress={goCheckout} />
      </AppView>
    </AppView>
  );
}

function SummaryRow({ label, value, tokens }: { label: string; value: string; tokens: ReturnType<typeof useThemeContext>['tokens'] }) {
  return (
    <AppView row justify="space-between" style={{ marginBottom: 4 }}>
      <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>{label}</AppText>
      <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.text }}>{value}</AppText>
    </AppView>
  );
}
