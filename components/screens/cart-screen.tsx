import { router } from 'expo-router';
import { AlertCircle, ShoppingBag, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ImageBox from '@/components/screens-components/home/image-box';
import { AppButton } from '@/components/shared/app-button';
import { AppPrice } from '@/components/shared/app-price';
import { AppQtyStepper } from '@/components/shared/app-qty-stepper';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { parsePrice } from '@/services/cart-math';

/**
 * Cart, on the real transport-abstracted cart context (`useCartContext`): one
 * white card per line item (compact image, two-line title, line price, one
 * − / qty / + control, remove), then the cost breakdown, with the total and
 * auth-gated Checkout fixed above the tab bar.
 *
 * Quantity mutations and removal are optimistic; a row mid-flight to the
 * transport is greyed via `pendingIds`.
 *
 * The figures in the breakdown are the server's (`charges`): the cost of the parts, a
 * discount and Mator's service fee, worked out again on every change to the cart. While a
 * change is on its way they are one step behind, and greyed like the row being changed.
 * A guest's cart is local only, so it has no fee yet: that is stated at checkout.
 */
export default function CartScreen() {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useUserContext();
  const {
    items,
    itemCount,
    totals,
    charges,
    incrementItem,
    decrementItem,
    removeItem,
    formatCurrency,
    pendingIds,
    isHydrated,
    error,
    refresh,
  } = useCartContext();

  // The server's figures trail a change on its way by one answer.
  const updating = pendingIds.size > 0;

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
        <AppText
          textVariant="h3"
          weight="bold"
          colorName="text"
          accessibilityRole="header"
          style={{ paddingHorizontal: 16, paddingTop: 8 }}
        >
          {t('cart.title')}
        </AppText>
        <AppView flex={1} center gap={14} px="xl">
          {error ? (
            <>
              <AlertCircle size={30} strokeWidth={2} color={tokens.error} />
              <AppText family="heading" colorName="text" style={{ fontSize: 18, lineHeight: 24 }}>
                {t('cart.loadErrorTitle')}
              </AppText>
              <AppText
                family="default"
                colorName="textMuted"
                style={{ fontSize: 13, lineHeight: 18, textAlign: 'center', maxWidth: 280 }}
              >
                {error}
              </AppText>
              <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={refresh} />
            </>
          ) : (
            <WheelLoader size={30} color={tokens.brand} />
          )}
        </AppView>
      </AppView>
    );
  }

  if (items.length === 0) {
    return (
      <AppView
        flex={1}
        colorName="background"
        testID="cart-screen"
        style={{ paddingTop: insets.top + 8 }}
      >
        <AppText
          textVariant="h3"
          weight="bold"
          colorName="text"
          accessibilityRole="header"
          style={{ paddingHorizontal: 16, paddingTop: 8 }}
        >
          {t('cart.title')}
        </AppText>
        {/* The group sits slightly above the centre of the content area. */}
        <AppView flex={1} center gap={12} px="xl" style={{ paddingBottom: 72 }}>
          <AppView
            center
            rounded={999}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 72, height: 72, backgroundColor: tokens.brandSoft }}
          >
            <ShoppingBag size={32} strokeWidth={2} color={tokens.brand} />
          </AppView>
          <AppText textVariant="h4" weight="bold" colorName="text" align="center">
            {t('cart.emptyTitle')}
          </AppText>
          <AppText
            textVariant="bodySm"
            colorName="textMuted"
            style={{ textAlign: 'center', maxWidth: 280 }}
          >
            {t('cart.emptySubtitle')}
          </AppText>
          <AppButton
            title={t('cart.startShopping')}
            kind="brand"
            size="lg"
            onPress={() => router.navigate('/explore')}
            containerStyle={{ marginTop: 4 }}
          />
        </AppView>
      </AppView>
    );
  }

  return (
    <AppView flex={1} colorName="background" testID="cart-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 16,
          gap: 8,
        }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            tintColor={tokens.textMuted}
            colors={[tokens.brandBg]}
          />
        }
      >
        <AppView style={{ paddingTop: 8, paddingBottom: 4 }}>
          <AppText textVariant="h3" weight="bold" colorName="text" accessibilityRole="header">
            {t('cart.title')}
          </AppText>
          <AppText textVariant="bodySm" colorName="textMuted">
            {t('cart.itemCount', { count: itemCount })}
          </AppText>
        </AppView>

        {error ? (
          <AppView row align="center" gap={8}>
            <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
            <AppText textVariant="bodySm" style={{ flex: 1, color: tokens.error }}>
              {error}
            </AppText>
          </AppView>
        ) : null}

        {items.map((item) => {
          const pending = pendingIds.has(item.id);
          return (
            <AppView
              key={item.id}
              testID={`cart-item-${item.id}`}
              row
              gap="md"
              rounded={12}
              colorName="card"
              borderWidth={1}
              borderName="border"
              style={{ padding: 12, opacity: pending ? 0.55 : 1 }}
            >
              <AppView style={{ width: 72, alignSelf: 'flex-start' }}>
                <ImageBox
                  label={item.title}
                  uri={item.imageUrl}
                  height={72}
                  radius={8}
                  contentFit="contain"
                  backgroundColor={tokens.white}
                  targetWidth={72}
                  small
                />
              </AppView>

              <AppView flex={1} gap={4} style={{ minWidth: 0 }}>
                <AppView row align="flex-start" gap="xs">
                  <AppText
                    family="default"
                    weight="semibold"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 14,
                      lineHeight: 20,
                      color: tokens.text,
                    }}
                  >
                    {item.title}
                  </AppText>
                  {/* Secondary: a muted glyph, with the full 48-unit target. */}
                  <AppPressableView
                    onPress={() => removeItem(item.id)}
                    testID={`cart-remove-${item.id}`}
                    androidRipple={false}
                    pressedOpacity={0.6}
                    center
                    accessibilityRole="button"
                    accessibilityLabel={t('cart.removeItem', { title: item.title })}
                    style={{ width: 48, height: 48, margin: -12, marginLeft: 0, flexShrink: 0 }}
                  >
                    <Trash2 size={18} strokeWidth={2} color={tokens.textMuted} />
                  </AppPressableView>
                </AppView>

                {item.description ? (
                  <AppText textVariant="bodyXs" colorName="textMuted">
                    {item.description}
                  </AppText>
                ) : null}
                {item.badge ? (
                  <AppText textVariant="bodyXs" weight="medium" colorName="textMuted">
                    {item.badge}
                  </AppText>
                ) : null}

                <AppView
                  row
                  wrap
                  align="center"
                  justify="space-between"
                  gap="sm"
                  style={{ marginTop: 'auto', paddingTop: 8 }}
                >
                  <AppPrice
                    value={formatCurrency(parsePrice(item.price) * item.quantity)}
                    size={16}
                    color={tokens.text}
                  />
                  <AppQtyStepper
                    testID={`cart-qty-${item.id}`}
                    value={item.quantity}
                    onIncrement={() => incrementItem(item.id)}
                    onDecrement={() => decrementItem(item.id)}
                    size="sm"
                  />
                </AppView>
              </AppView>
            </AppView>
          );
        })}

        {/* The cost breakdown follows the items; only the total and checkout stay
         *  fixed, and the scroll view ends above them so nothing is covered. */}
        <AppView
          testID="cart-summary"
          rounded={16}
          colorName="card"
          borderWidth={1}
          borderName="border"
          gap="sm"
          style={{ padding: 16, marginTop: 8, opacity: charges && updating ? 0.55 : 1 }}
        >
          <SummaryRow
            label={t('cart.subtotal')}
            value={formatCurrency(charges ? charges.subtotal : totals.subtotal)}
            tokens={tokens}
          />
          {(charges ? charges.discount : totals.discount) > 0 ? (
            <SummaryRow
              label={t('cart.discount')}
              value={`−${formatCurrency(charges ? charges.discount : totals.discount)}`}
              tokens={tokens}
            />
          ) : null}
          {!charges ? (
            <SummaryRow
              label={t('cart.serviceFee')}
              value={t('cart.deliveryAtCheckout')}
              tokens={tokens}
            />
          ) : charges.serviceFee > 0 ? (
            <SummaryRow
              label={t('cart.serviceFee')}
              value={formatCurrency(charges.serviceFee)}
              tokens={tokens}
            />
          ) : null}
          <SummaryRow
            label={t('cart.shipping')}
            value={t('cart.deliveryAtCheckout')}
            tokens={tokens}
          />
        </AppView>
      </ScrollView>

      {/* Fixed above the tab bar, which owns the bottom safe area. */}
      <AppView
        colorName={scheme === 'dark' ? 'background' : 'surface'}
        px="lg"
        gap="sm"
        style={{
          paddingTop: 12,
          paddingBottom: 12,
          borderTopWidth: 1,
          borderTopColor: tokens.divider,
        }}
      >
        <AppView row align="center" justify="space-between" gap="sm">
          <AppText textVariant="bodySm" weight="medium" colorName="textMuted">
            {t('cart.total')}
          </AppText>
          <AppView style={{ opacity: charges && updating ? 0.55 : 1 }}>
            <AppPrice
              value={formatCurrency(charges ? charges.total : totals.total)}
              size={20}
              color={tokens.text}
            />
          </AppView>
        </AppView>
        <AppButton
          testID="cart-checkout-btn"
          title={t('cart.checkout')}
          kind="brand"
          size="lg"
          fullWidth
          onPress={goCheckout}
        />
      </AppView>
    </AppView>
  );
}

function SummaryRow({
  label,
  value,
  tokens,
}: {
  label: string;
  value: string;
  tokens: ReturnType<typeof useThemeContext>['tokens'];
}) {
  return (
    <AppView row justify="space-between" gap="md">
      <AppText
        family="default"
        style={{ flex: 1, fontSize: 14, lineHeight: 20, color: tokens.textMuted }}
      >
        {label}
      </AppText>
      <AppText
        family="accent"
        weight="semibold"
        style={{ fontSize: 14, lineHeight: 20, color: tokens.text, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
    </AppView>
  );
}
