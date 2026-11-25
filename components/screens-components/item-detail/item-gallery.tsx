import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react-native';
import {
  Dimensions,
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import ImageBox from '@/components/screens-components/home/image-box';
import ProductImagePlaceholder from '@/components/shared/product-image-placeholder';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { openMatorAIShopping } from '@/utils/mator-ai-shopping';

export type ItemGalleryProps = {
  /** Real catalog photo URLs. Empty renders a single placeholder page. */
  images: string[];
  /** Product title — the accessibility label for every page. */
  title: string;
  height: number;
  /** Discount percent for the corner badge. 0 hides it. */
  savePct?: number;
  index: number;
  onIndexChange: (index: number) => void;
  onPressImage: (index: number) => void;
  categoryId?: string;
  productId?: string;
  manufacturer?: string;
  partNumber?: string;
  oemNumbers?: string[];
  photoPlanned?: boolean;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Full-bleed, swipeable product gallery for Item Detail.
 *
 * Catalog photos are shot on white and vary wildly in shape, so every page is
 * `contain`-fitted onto a white tile — the whole part is visible, never
 * cropped. Because that tile is white in BOTH themes, the overlays (counter,
 * dots, sale badge) use the theme-independent `scrim` / `white` tokens rather
 * than text/background, which would vanish in dark mode.
 *
 * Paging is real: the active dot and the "2 / 5" counter follow the scroll, so
 * a multi-photo part no longer lies about which image you're on. Both sit well
 * clear of the bottom edge — the detail sheet rides ~24px over the gallery.
 */
function ItemGallery({
  images,
  title,
  height,
  savePct = 0,
  index,
  onIndexChange,
  onPressImage,
  categoryId,
  productId,
  manufacturer,
  partNumber,
  oemNumbers,
  photoPlanned = false,
}: ItemGalleryProps) {
  const { t, i18n } = useTranslation();
  const { tokens } = useThemeContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const [width, setWidth] = useState(SCREEN_WIDTH);
  const imageKey = JSON.stringify(images);
  const [imageFailures, setImageFailures] = useState<{ key: string; sources: string[] }>({
    key: imageKey,
    sources: [],
  });
  const failedSources = imageFailures.key === imageKey ? imageFailures.sources : [];
  const usableImages = images.filter((uri) => !failedSources.includes(uri));
  const hasPhoto = usableImages.length > 0;

  // No photos → one placeholder page, still tappable-free (nothing to zoom).
  const pages = hasPhoto ? usableImages : [undefined];
  const total = pages.length;
  const displayHeight = hasPhoto ? height : 254;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  // The counter and dots follow the live scroll position: whichever photo is
  // more than half in view is the current one. Updating only when a swipe
  // ended left them on "1" while the photos moved; a scroll event fires on
  // every frame the pager moves, so a swipe can't slip past without one.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.max(
      0,
      Math.min(total - 1, Math.round(e.nativeEvent.contentOffset.x / width)),
    );
    if (next !== index) onIndexChange(next);
  };

  return (
    <AppView
      onLayout={onLayout}
      style={{
        height: displayHeight,
        backgroundColor: hasPhoto ? tokens.white : 'transparent',
        marginHorizontal: hasPhoto ? 0 : 16,
      }}
    >
      {!hasPhoto ? (
        <>
          <ProductImagePlaceholder
            categoryId={categoryId}
            manufacturer={manufacturer}
            manufacturerMaxWidth="100%"
            photoPlanned={photoPlanned}
            showPhotoCaption
            photoCaption={t(
              photoPlanned ? 'itemDetail.photoPlannedDetail' : 'catalog.photoOnRequest',
            )}
            label={title}
            width="100%"
            height={204}
            radius={18}
          />
          <AppPressableView
            onPress={() =>
              openMatorAIShopping(
                {
                  source: 'product_photo_request',
                  intent: 'request_photo',
                  productId,
                  productName: title,
                  manufacturer,
                  partNumber,
                  oemNumbers,
                  vehicle: currentActiveVehicle?.vehicle
                    ? [
                        currentActiveVehicle.vehicle.year,
                        currentActiveVehicle.vehicle.make,
                        currentActiveVehicle.vehicle.model,
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : undefined,
                },
                i18n.language,
              )
            }
            row
            align="center"
            justify="center"
            gap={7}
            accessibilityRole="button"
            accessibilityLabel={t('itemDetail.requestPhotoViaAI')}
            style={{ height: 50 }}
          >
            <Camera size={16} strokeWidth={1.9} color={tokens.brandText} />
            <AppText
              family="accent"
              weight="semibold"
              style={{ fontSize: 13, color: tokens.brandText }}
            >
              {t('itemDetail.requestPhotoViaAI')}
            </AppText>
          </AppPressableView>
        </>
      ) : (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // The gallery is a horizontal pager nested inside the detail screen's
          // VERTICAL scroll view. On Android nested scrolling is off by default,
          // so the parent swallowed the horizontal drag and the hero never paged
          // — the full-screen viewer (a Modal, no scrolling parent) was the only
          // place swiping worked. `directionalLockEnabled` is the iOS half of the
          // same fix: it stops a slightly-diagonal swipe from being read as a
          // vertical scroll of the page behind.
          nestedScrollEnabled
          directionalLockEnabled
          snapToInterval={width}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={total > 1}
        >
          {pages.map((uri, i) => (
            <AppPressableView
              key={uri ?? `placeholder-${i}`}
              onPress={() => uri && onPressImage(i)}
              androidRipple={false}
              disabled={!uri}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('itemDetail.viewFullScreen', { title })}
              style={{ width, height }}
            >
              <ImageBox
                label={title}
                uri={uri}
                manufacturer={manufacturer}
                width={width}
                height={height}
                contentFit="contain"
                backgroundColor={tokens.white}
                onPhotoLoad={() => {
                  if (!uri) return;
                  setImageFailures((current) => ({
                    key: imageKey,
                    sources: (current.key === imageKey ? current.sources : []).filter(
                      (failed) => failed !== uri,
                    ),
                  }));
                }}
                onPhotoError={() => {
                  if (!uri) return;
                  setImageFailures((current) => {
                    const currentSources = current.key === imageKey ? current.sources : [];
                    return currentSources.includes(uri)
                      ? current
                      : { key: imageKey, sources: [...currentSources, uri] };
                  });
                }}
              />
            </AppPressableView>
          ))}
        </ScrollView>
      )}

      {/* Sale badge — same signal as the listing card, carried into detail. */}
      {hasPhoto && savePct > 0 ? (
        <AppView
          rounded={8}
          px={9}
          py={5}
          style={{ position: 'absolute', left: 16, top: 12, backgroundColor: tokens.value }}
        >
          <AppText family="accent" weight="bold" style={{ fontSize: 11, color: tokens.onValue }}>
            {t('home.savePercent', { percent: savePct })}
          </AppText>
        </AppView>
      ) : null}

      {/* Page counter — only when there is something to page through. */}
      {total > 1 ? (
        <AppView
          rounded={999}
          px={10}
          py={4}
          style={{ position: 'absolute', right: 16, bottom: 38, backgroundColor: tokens.scrim }}
        >
          <AppText family="accent" weight="semibold" style={{ fontSize: 11, color: tokens.white }}>
            {t('itemDetail.imageCounter', { current: index + 1, total })}
          </AppText>
        </AppView>
      ) : null}

      {/* Dots — the active one stretches into a pill. */}
      {total > 1 ? (
        <AppView
          row
          justify="center"
          align="center"
          gap={6}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 42 }}
        >
          {pages.map((uri, i) => (
            <AppView
              key={`dot-${uri ?? i}`}
              style={{
                width: i === index ? 20 : 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: i === index ? tokens.scrim : 'rgba(0, 0, 0, 0.18)',
              }}
            />
          ))}
        </AppView>
      ) : null}
    </AppView>
  );
}

export default memo(ItemGallery);
