import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, ArrowLeft, Heart } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ImageBox from '@/components/screens-components/home/image-box';
import { AppButton } from '@/components/shared/app-button';
import AppImageViewer from '@/components/shared/app-image-viewer/app-image-viewer';
import { AppOemPill } from '@/components/shared/app-oem-pill';
import { AppQtyStepper } from '@/components/shared/app-qty-stepper';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useCartContext } from '@/contexts/cart.context';
import { useLikesContext } from '@/contexts/likes.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useCatalogDetail } from '@/hooks/use-catalog-detail';
import { useToast } from '@/hooks/use-toast';
import { parsePrice } from '@/services/cart-math';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Item Detail — backed by the REAL catalog (`useCatalogDetail`). Hero image,
 * title, OEM pill, price, confirmed-fit (from the active garage vehicle),
 * quantity stepper, the catalog's own spec table, and a sticky guest-gated
 * Add-to-cart bar. The real `CatalogItem.id` flows into the cart (and thus the
 * order), so the buy path is consistent end-to-end. Fields the catalog doesn't
 * carry (rating, was-price, reviews, related) are omitted rather than faked.
 */
export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { addItem, formatCurrency } = useCartContext();
  const { isLiked, toggleLike } = useLikesContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const { isAuthenticated } = useUserContext();
  const [qty, setQty] = useState(1);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { state, detail, error, refresh } = useCatalogDetail(id ?? null);
  const item = detail?.item ?? null;
  const activeVehicle = currentActiveVehicle?.vehicle ?? null;

  if (state === 'loading' || state === 'idle') {
    return (
      <AppView flex={1} colorName="background" center>
        <WheelLoader size={30} color={tokens.text} />
      </AppView>
    );
  }

  if (state === 'error' || state === 'not_found' || !item) {
    return (
      <AppView flex={1} colorName="background" center px="xl" gap={12} style={{ paddingTop: insets.top }}>
        <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
        <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text }}>
          {state === 'not_found' ? 'Product not found' : "Couldn't load product"}
        </AppText>
        <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}>
          {error ?? 'This item may no longer be available.'}
        </AppText>
        <AppView row gap={10}>
          <AppButton title="Go back" kind="secondary" size="sm" onPress={() => router.back()} />
          {state === 'error' ? <AppButton title="Retry" kind="brand" size="sm" onPress={refresh} /> : null}
        </AppView>
      </AppView>
    );
  }

  const image = item.images?.[0];
  const isFavorite = isLiked(item.id);

  const toggleFavorite = () => {
    const nowFav = toggleLike(item.id);
    toast.info(nowFav ? 'Saved to favorites' : 'Removed from favorites');
  };

  // Guest-first purchase gate: guests go to Sign In; signed-in users add the
  // real catalog item `qty` times (one unit per `addItem`) and land on Cart.
  const addToCart = () => {
    if (!isAuthenticated) {
      triggerHaptic('selection');
      router.push('/sign-in?gate=1');
      return;
    }
    triggerHaptic('success');
    const cartItem = {
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      imageUrl: image,
    };
    for (let i = 0; i < qty; i += 1) addItem(cartItem);
    setQty(1);
    router.replace('/cart');
  };

  return (
    <AppView flex={1} colorName="background" testID="item-detail-screen">
      <AppScrollRegion insetTop={insets.top}>
        {/* Header: back + favorite */}
        <AppView row align="center" justify="space-between" px="lg" style={{ paddingTop: 6, paddingBottom: 14 }}>
          <AppPressableView
            onPress={() => router.back()}
            center
            rounded={12}
            borderWidth={1}
            borderName="border"
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 40, height: 40 }}
          >
            <ArrowLeft size={22} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
          <AppPressableView
            onPress={toggleFavorite}
            center
            rounded={12}
            borderWidth={1}
            borderName="border"
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
            style={{ width: 40, height: 40 }}
          >
            <Heart
              size={20}
              strokeWidth={2.2}
              color={isFavorite ? tokens.error : tokens.text}
              fill={isFavorite ? tokens.error : 'none'}
            />
          </AppPressableView>
        </AppView>

        {/* Hero + dots — tap the image to open the full-screen viewer. */}
        <AppView px="lg">
          <AppPressableView
            onPress={() => image && setViewerOpen(true)}
            androidRipple={false}
            accessibilityRole="imagebutton"
            accessibilityLabel={`View ${item.title} full screen`}
          >
            {/* `contain` on a white tile shows the whole part (no cropping),
                since catalog photos are shot on white and vary in shape. */}
            <ImageBox
              label={item.title}
              uri={image}
              height={240}
              radius={20}
              contentFit="contain"
              backgroundColor={tokens.white}
            />
          </AppPressableView>
          {item.images.length > 1 ? (
            <AppView row justify="center" gap={8} style={{ marginTop: 10 }}>
              {item.images.map((src, i) => (
                <AppView
                  key={src}
                  style={{
                    width: i === 0 ? 22 : 7,
                    height: 7,
                    borderRadius: 999,
                    backgroundColor: i === 0 ? tokens.text : tokens.border,
                  }}
                />
              ))}
            </AppView>
          ) : null}
        </AppView>

        {/* Body */}
        <AppView px="lg" gap={16} style={{ paddingTop: 16 }}>
          {item.badge ? (
            <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
              {item.badge}
            </AppText>
          ) : null}

          <AppText
            family="heading"
            weight="bold"
            style={{ fontSize: 24, lineHeight: 29, color: tokens.text, marginTop: item.badge ? -6 : 0 }}
          >
            {item.title}
          </AppText>

          {item.oem || item.gm ? <AppOemPill oem={item.oem} gm={item.gm} /> : null}

          <AppText family="heading" weight="bold" style={{ fontSize: 30, lineHeight: 36, color: tokens.info }}>
            {item.price}
          </AppText>

          {/* Confirmed fit — only when a vehicle is active in the garage. */}
          {activeVehicle ? (
            <AppView row align="center" gap={10} rounded={14} p={14} colorName="backgroundSecondary" borderWidth={1} borderName="border">
              <AppView center rounded={999} style={{ width: 22, height: 22, backgroundColor: tokens.success }}>
                <AppText weight="bold" style={{ fontSize: 13, color: tokens.white }}>✓</AppText>
              </AppView>
              <AppView flex={1}>
                <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.text }}>
                  Confirmed fit
                </AppText>
                <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
                  {`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model} ${activeVehicle.trim ?? ''}`.trim()}
                </AppText>
              </AppView>
            </AppView>
          ) : null}

          {/* Quantity */}
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text, marginTop: 4 }}>
            Quantity
          </AppText>
          <AppView row align="center" gap={18}>
            <AppQtyStepper value={qty} onIncrement={() => setQty((q) => q + 1)} onDecrement={() => setQty((q) => Math.max(1, q - 1))} size="md" />
          </AppView>

          {/* Spec table (from the catalog) */}
          {item.specs.length > 0 ? (
            <AppView rounded={14} borderWidth={1} borderName="border" style={{ overflow: 'hidden' }}>
              {item.specs.map((row, i) => (
                <AppView
                  key={row.label}
                  row
                  align="center"
                  justify="space-between"
                  style={{ paddingHorizontal: 15, paddingVertical: 13, borderBottomWidth: i < item.specs.length - 1 ? 1 : 0, borderBottomColor: tokens.divider }}
                >
                  <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>{row.label}</AppText>
                  <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.text }}>{row.value}</AppText>
                </AppView>
              ))}
            </AppView>
          ) : null}
        </AppView>
      </AppScrollRegion>

      {/* Sticky bottom bar */}
      <AppView
        row
        align="center"
        gap={12}
        px="lg"
        colorName="background"
        style={{ paddingTop: 14, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderTopColor: tokens.divider }}
      >
        <AppView>
          <AppText family="default" style={{ fontSize: 11, color: tokens.textMuted }}>Total</AppText>
          <AppText family="heading" weight="bold" style={{ fontSize: 20, color: tokens.text }}>
            {formatCurrency(parsePrice(item.price) * qty)}
          </AppText>
        </AppView>
        <AppView flex={1}>
          <AppButton testID="add-to-cart-btn" title="Add to cart" kind="brand" size="lg" fullWidth onPress={addToCart} />
        </AppView>
      </AppView>

      {/* Full-screen image viewer — opened by tapping the hero. */}
      <AppImageViewer
        visible={viewerOpen}
        images={item.images.map((uri) => ({ uri }))}
        onClose={() => setViewerOpen(false)}
        renderCaption={(i) =>
          item.images.length > 1 ? `${i + 1} of ${item.images.length}` : null
        }
      />
    </AppView>
  );
}

// Local lightweight scroll wrapper so the sticky bottom bar stays fixed while
// the content scrolls. Kept inline to avoid a new shared file.
function AppScrollRegion({ children, insetTop }: { children: ReactNode; insetTop: number }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: insetTop + 4, paddingBottom: 24 }}
      style={{ flex: 1 }}
    >
      {children}
    </ScrollView>
  );
}
