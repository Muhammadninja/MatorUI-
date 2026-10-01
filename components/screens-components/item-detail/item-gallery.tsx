import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import ImageBox from '@/components/screens-components/home/image-box';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

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
}: ItemGalleryProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const [width, setWidth] = useState(SCREEN_WIDTH);

  // No photos → one placeholder page, still tappable-free (nothing to zoom).
  const pages = images.length > 0 ? images : [undefined];
  const total = pages.length;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.max(
      0,
      Math.min(total - 1, Math.round(e.nativeEvent.contentOffset.x / width)),
    );
    if (next !== index) onIndexChange(next);
  };

  return (
    <AppView onLayout={onLayout} style={{ height, backgroundColor: tokens.white }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
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
              width={width}
              height={height}
              contentFit="contain"
              backgroundColor={tokens.white}
            />
          </AppPressableView>
        ))}
      </ScrollView>

      {/* Sale badge — same signal as the listing card, carried into detail. */}
      {savePct > 0 ? (
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

      {/* The viewer is the only way to see a photo at full size, and a bare
          tap target advertises nothing — so name it. Text, not a glyph. */}
      {images.length > 0 ? (
        <AppView
          rounded={999}
          px={10}
          py={4}
          style={{ position: 'absolute', left: 16, bottom: 38, backgroundColor: tokens.scrim }}
        >
          <AppText family="accent" weight="semibold" style={{ fontSize: 11, color: tokens.white }}>
            {t('itemDetail.fullScreen')}
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
