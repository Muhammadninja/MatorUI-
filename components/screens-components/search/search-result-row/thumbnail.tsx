import AppImage from '@/components/shared/app-image';
import { AppView } from '@/components/shared/app-view';
import PartImagePlaceholder from '@/components/shared/part-image-placeholder';
import { useThemeContext } from '@/contexts/theme.context';

import { RADIUS_MEDIA } from '../radii';

const THUMB_PADDING = 6;
/** The tile sits this far inside the card's top, left and bottom edges. */
export const THUMB_INSET = 8;

export type ThumbnailProps = {
  /** Accessibility label — the part name. */
  alt: string;
  /** Real product photo. Omitted/empty → the neutral no-photo placeholder. */
  uri?: string;
  /** Tile width; the tile is at least this tall and stretches with the card. */
  width: number;
};

export default function Thumbnail({ alt, uri, width }: ThumbnailProps) {
  const { tokens } = useThemeContext();
  const placeholder = (
    <PartImagePlaceholder label={alt} width="100%" height="100%" backgroundColor="transparent" />
  );

  return (
    // A rounded tile inset in the card. White, because most catalog photos carry
    // a baked-in white ground that would show as a box on any other colour;
    // `contain` keeps each product's proportions instead of cutting it in half.
    <AppView
      style={{
        width,
        minHeight: width,
        alignSelf: 'stretch',
        flexShrink: 0,
        margin: THUMB_INSET,
        marginRight: 0,
        padding: THUMB_PADDING,
        overflow: 'hidden',
        borderRadius: RADIUS_MEDIA,
        backgroundColor: tokens.white,
      }}
    >
      {uri ? (
        <AppImage
          source={uri}
          width="100%"
          height="100%"
          targetWidth={width}
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
