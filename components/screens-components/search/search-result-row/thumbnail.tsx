import { AppView } from '@/components/shared/app-view';
import PartImagePlaceholder from '@/components/shared/part-image-placeholder';

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
      {/* This row has never had a real photo to show — the slot was hard-wired
       *  to the stand-in PNG. It now draws the neutral part placeholder, which
       *  also retires the `scale(1.08)` overscan hack that existed only to crop
       *  the thin border baked into that asset. */}
      <PartImagePlaceholder
        label={alt}
        width="100%"
        height="100%"
        backgroundColor="transparent"
      />
    </AppView>
  );
}
