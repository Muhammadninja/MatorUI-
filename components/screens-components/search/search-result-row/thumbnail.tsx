import AppImage from '@/components/shared/app-image';
import { AppView } from '@/components/shared/app-view';
import PartImagePlaceholder from '@/components/shared/part-image-placeholder';
import { useThemeContext } from '@/contexts/theme.context';

import { RADIUS_MEDIA } from '../radii';

const THUMB_SIZE = 104;
const THUMB_PADDING = 6;

export type ThumbnailProps = {
  /** Accessibility label — the part name. */
  alt: string;
  /** Real product photo. Omitted/empty → the neutral no-photo placeholder. */
  uri?: string;
};

export default function Thumbnail({ alt, uri }: ThumbnailProps) {
  const { tokens } = useThemeContext();
  const placeholder = (
    <PartImagePlaceholder label={alt} width="100%" height="100%" backgroundColor="transparent" />
  );

  return (
    // The same white tile and padding for every result, in both themes; `contain`
    // keeps each product's own proportions inside it, because catalog photos come
    // in every aspect ratio and cropping would cut the part in half.
    <AppView
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        flexShrink: 0,
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
          targetWidth={THUMB_SIZE}
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
