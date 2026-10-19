import AppImage from '@/components/shared/app-image';
import { AppView } from '@/components/shared/app-view';
import PartImagePlaceholder from '@/components/shared/part-image-placeholder';

import { RADIUS_MEDIA } from '../radii';

const THUMB_WIDTH = 150;
const THUMB_HEIGHT = 150;

export type ThumbnailProps = {
  /** Accessibility label — the part name. */
  alt: string;
  /** Real product photo. Omitted/empty → the neutral no-photo placeholder. */
  uri?: string;
};

export default function Thumbnail({ alt, uri }: ThumbnailProps) {
  const placeholder = (
    <PartImagePlaceholder label={alt} width="100%" height="100%" backgroundColor="transparent" />
  );

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
      {uri ? (
        // `contain` on a transparent tile: catalog photos are shot on white in
        // every aspect ratio, so cropping to fill would cut the part in half.
        <AppImage
          source={uri}
          width="100%"
          height="100%"
          rounded={RADIUS_MEDIA}
          targetWidth={THUMB_WIDTH}
          contentFit="contain"
          placeholderColor="transparent"
          fallback={placeholder}
          alt={alt}
        />
      ) : (
        placeholder
      )}
    </AppView>
  );
}
