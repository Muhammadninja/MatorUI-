import AppImage from '@/components/shared/app-image';
import { AppView } from '@/components/shared/app-view';

import { RADIUS_MEDIA } from '../radii';

const THUMB_WIDTH = 150;
const THUMB_HEIGHT = 150;

export default function Thumbnail({ alt }: { alt: string }) {
  return (
    <AppView
      style={{
        // Lock the WIDTH so flex can't stretch or shrink the box under any
        // parent — `align="stretch"` on a row stretches vertically, but
        // some hosts have been observed growing this box horizontally
        // when sibling content is taller than 150.
        width: THUMB_WIDTH,
        minWidth: THUMB_WIDTH,
        maxWidth: THUMB_WIDTH,
        flexBasis: THUMB_WIDTH,
        flexGrow: 0,
        flexShrink: 0,
        alignSelf: 'stretch',
        minHeight: THUMB_HEIGHT,
        overflow: 'hidden',
        borderRadius: RADIUS_MEDIA,
        // No background, no borders — anything sitting underneath the
        // image bleeds out the rounded-corner clip as a 1-2px gray
        // outline (the antialiased boundary mixes the bg color into the
        // visible edge). Letting the card's own bg show through fixes it.
      }}
    >
      {/* Overscan-crop via transform: image stays in normal flow at
       *  100%×100%, then `scale(1.08)` zooms the rendered output ~8%
       *  around its center. The wrapper's `overflow:hidden` clips
       *  ~4% from every edge — hides any thin border baked into the
       *  asset (the test PNG has one) without touching layout. */}
      <AppImage
        source={require('@/assets/images/test-image.png')}
        width="100%"
        height="100%"
        contentFit="cover"
        placeholderColor="transparent"
        style={{ transform: [{ scale: 1.08 }] }}
        alt={alt}
      />
    </AppView>
  );
}
