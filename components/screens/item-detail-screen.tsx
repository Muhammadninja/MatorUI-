import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Animated, Platform, StatusBar, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import { AppImageCarousel } from '@/components/shared/app-image-carousel/app-image-carousel';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { getCatalogMockDetail } from '@/services/catalog-service';
import { getTopFeaturedMockDetail } from '@/services/top-featured-service';
import { triggerHaptic } from '@/utils/haptics';

const IMAGE_HEIGHT = 360;

const HERO_IMAGES = [
  require('@/assets/images/test-image.png'),
  require('@/assets/images/test-image.png'),
  require('@/assets/images/test-image.png'),
];

const FALLBACK_SPECS = [
  { label: 'Range', value: '320 mi' },
  { label: '0-60 mph', value: '4.2s' },
  { label: 'Top Speed', value: '155 mph' },
  { label: 'Drivetrain', value: 'AWD' },
];

const FALLBACK_FEATURES = [
  'Smart safety assist with collision avoidance',
  'Adaptive cruise control with lane centering',
  'Panoramic glass roof with UV protection',
  'Premium sound system with 12 speakers',
  'Over-the-air software updates',
];

export default function ItemDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    description?: string;
    price?: string;
    priceLabel?: string;
    badge?: string;
    status?: string;
  }>();

  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { addItem } = useCartContext();

  // Resolve the item dynamically from id — checks catalog first, then top-featured.
  const id = params.id;
  const catalogDetail = id ? getCatalogMockDetail(id) : null;
  const topFeaturedDetail = !catalogDetail && id ? getTopFeaturedMockDetail(id) : null;

  const title = catalogDetail?.item.title ?? topFeaturedDetail?.title ?? params.title ?? '';
  const description =
    catalogDetail?.item.description ??
    topFeaturedDetail?.description ??
    params.description ??
    '';
  const price = catalogDetail?.item.price ?? topFeaturedDetail?.price ?? params.price ?? '';
  const priceLabel = catalogDetail?.item.priceLabel ?? params.priceLabel ?? 'Starting at';
  const badge = catalogDetail?.item.badge ?? topFeaturedDetail?.badge ?? params.badge;
  const status = catalogDetail?.item.status ?? topFeaturedDetail?.status ?? params.status;
  const oem = catalogDetail?.item.oem ?? topFeaturedDetail?.oem;
  const specs = catalogDetail?.item.specs ?? FALLBACK_SPECS;
  const features = catalogDetail?.item.features ?? FALLBACK_FEATURES;

  const [wasAdded, setWasAdded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const handleAddToCart = () => {
    triggerHaptic('success');
    addItem({
      id: id ?? '',
      title,
      description,
      price,
      priceLabel,
      badge,
      status,
    });
    setWasAdded(true);
    if (resetRef.current) clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => setWasAdded(false), 1400);
  };

  // Image translates with scroll to appear pinned
  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, IMAGE_HEIGHT],
    outputRange: [0, IMAGE_HEIGHT * 0.5],
    extrapolate: 'clamp',
  });

  return (
    <AppView flex={1} colorName="background">
      {Platform.OS === 'android' ? (
        <StatusBar translucent backgroundColor="transparent" />
      ) : null}
      {/* Nav buttons (floating) */}
      <AppView
        row
        justify="space-between"
        align="center"
        px="lg"
        style={[styles.navBar, { top: insets.top + 4 }]}
      >
        {/* Floating nav buttons over the hero image. The 1px border is
         *  load-bearing in light mode: `tokens.surface` is near-white,
         *  so on a white-background product photo the filled circle
         *  disappears without a stroke outlining it. */}
        <AppPressableView
          center
          rounded={36}
          onPress={() => router.back()}
          androidRipple
          borderWidth={1}
          borderName="border"
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
          style={[styles.iconButton, { backgroundColor: tokens.surface }]}
        >
          <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
        </AppPressableView>

        <AppView row gap={10}>
          <AppPressableView
            center
            rounded={36}
            onPress={() => {
              triggerHaptic('selection');
              setIsLiked((v) => !v);
            }}
            androidRipple
            borderWidth={1}
            borderName="border"
            hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
            style={[styles.iconButton, { backgroundColor: tokens.surface }]}
          >
            <Heart
              size={20}
              strokeWidth={2.2}
              color={isLiked ? tokens.error : tokens.text}
              fill={isLiked ? tokens.error : 'none'}
            />
          </AppPressableView>
          <AppPressableView
            center
            rounded={36}
            androidRipple
            borderWidth={1}
            borderName="border"
            hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
            style={[styles.iconButton, { backgroundColor: tokens.surface }]}
          >
            <Share2 size={20} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
        </AppView>
      </AppView>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Carousel inside scroll — receives touches, visually pinned via transform */}
        <Animated.View style={[styles.carouselWrap, { transform: [{ translateY: imageTranslateY }] }]}>
          <AppImageCarousel
            sources={HERO_IMAGES}
            height={IMAGE_HEIGHT}
            rounded={0}
            showIndicators="dots"
            dotsVariant="pill"
            dotsAlign="right"
            dotsContainerStyle={styles.dotsPosition}
          />
        </Animated.View>

        {/* Content overlaps image with rounded top */}
        <AppView colorName="background" roundedTop={24} px="lg" pt={20} gap="xl" style={styles.content}>
          {/* Title + price */}
          <AppView gap="sm">
            <AppText textVariant="title" family="heading" weight="bold">
              {title}
            </AppText>
            <AppText textVariant="body" colorName="gray400">
              {description}
            </AppText>
            <AppView row align="flex-end" gap={6} mt="xs">
              <AppText textVariant="bodyXs" colorName="gray400">
                {priceLabel || 'Starting at'}
              </AppText>
              <AppText textVariant="h3" family="heading" weight="bold">
                {price}
              </AppText>
            </AppView>
            {oem ? (
              <AppView
                rounded={8}
                px={10}
                py={6}
                mt="xs"
                style={{ alignSelf: 'flex-start', backgroundColor: tokens.gray100 }}
              >
                <AppText textVariant="bodyXs" colorName="gray400">
                  OEM {oem}
                </AppText>
              </AppView>
            ) : null}
          </AppView>

          {/* Specs grid */}
          <AppView gap="md">
            <AppText textVariant="h4" family="heading" weight="semibold">
              Specifications
            </AppText>
            <AppView row wrap gap={10}>
              {specs.map((spec) => (
                <AppView
                  key={spec.label}
                  flex={1}
                  p={14}
                  rounded={16}
                  colorName="card"
                  borderWidth={1}
                  borderName="border"
                  style={styles.specCard}
                >
                  <AppText textVariant="bodyXs" colorName="gray400">
                    {spec.label}
                  </AppText>
                  <AppText textVariant="body" family="heading" weight="semibold">
                    {spec.value}
                  </AppText>
                </AppView>
              ))}
            </AppView>
          </AppView>

          {/* Features */}
          <AppView gap="md" pb={120}>
            <AppText textVariant="h4" family="heading" weight="semibold">
              Key Features
            </AppText>
            <AppView gap={10}>
              {features.map((feature) => (
                <AppView key={feature} row align="flex-start" gap={10}>
                  <AppView
                    rounded={36}
                    center
                    style={[styles.featureDot, { backgroundColor: tokens.secondary }]}
                  />
                  <AppText textVariant="body" style={styles.featureText}>
                    {feature}
                  </AppText>
                </AppView>
              ))}
            </AppView>
          </AppView>
        </AppView>
      </Animated.ScrollView>

      {/* Sticky bottom bar */}
      <AppView
        row
        align="center"
        justify="space-between"
        px="lg"
        py="md"
        pb={Math.max(insets.bottom, 16)}
        colorName="background"
        borderTopWidth={1}
        borderName="divider"
      >
        <AppView gap={2}>
          <AppText textVariant="bodyXs" colorName="gray400">
            {priceLabel || 'Starting at'}
          </AppText>
          <AppText textVariant="h4" family="heading" weight="bold">
            {price}
          </AppText>
        </AppView>
        <AppButton
          kind="secondary"
          size="md"
          accessibilityLabel={wasAdded ? 'Added to cart' : 'Add to cart'}
          onPress={handleAddToCart}
        >
          <AppView row align="center" gap={6}>
            {!wasAdded ? (
              <AppText weight="bold" colorName="onSecondary" fontSize={18}>+</AppText>
            ) : null}
            <AppText weight="semibold" colorName="onSecondary">
              {wasAdded ? 'Added!' : 'Add to Cart'}
            </AppText>
          </AppView>
        </AppButton>
      </AppView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
  },
  carouselWrap: {
    height: IMAGE_HEIGHT,
    overflow: 'hidden',
  },
  content: {
    marginTop: -24,
  },
  dotsPosition: {
    bottom: 36,
  },
  iconButton: {
    width: 40,
    height: 40,
  },
  specCard: {
    minWidth: '45%',
  },
  featureDot: {
    width: 6,
    height: 6,
    marginTop: 7,
  },
  featureText: {
    flex: 1,
  },
});
