import AppImage from '@/components/shared/app-image';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import CornerRibbon from './corner-ribbon';

const CHEAPEST_GREEN = '#999';
const THUMB_WIDTH = 150;
const THUMB_HEIGHT = 190;

export default function Thumbnail(props: {
  badge?: string;
  alt: string;
  /** When true, render a green CHEAPEST ribbon instead of the badge ribbon. */
  isCheapest?: boolean | string;
}) {
  const { badge, alt, isCheapest } = props;
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  return (
    <AppView
      style={{
        // Lock the WIDTH so flex can't stretch or shrink the box under any
        // parent — `align="stretch"` on a row stretches vertically, but
        // some hosts have been observed growing this box horizontally
        // when sibling content is taller than 190.
        width: THUMB_WIDTH,
        minWidth: THUMB_WIDTH,
        maxWidth: THUMB_WIDTH,
        flexBasis: THUMB_WIDTH,
        flexGrow: 0,
        flexShrink: 0,
        // Height is flexible: stretch to match the row (driven by the text
        // column) so a tall text section never leaves the image short.
        // THUMB_HEIGHT is only a floor for short cards.
        alignSelf: 'stretch',
        minHeight: THUMB_HEIGHT,
        overflow: 'hidden',
        position: 'relative',
        borderTopLeftRadius: 13,
        borderBottomLeftRadius: 13,
        backgroundColor: isDark ? tokens.gray200 : tokens.gray100,
      }}
    >
      <AppImage
        source={require('@/assets/images/test-image.png')}
        width="100%"
        height="100%"
        contentFit="cover"
        alt={alt}
      />
      {isCheapest ? (
        <CornerRibbon label="Cheapest" color={CHEAPEST_GREEN} textColor="#ffffff"  />
      ) : badge ? (
        <CornerRibbon label={badge} />
      ) : null}
    </AppView>
  );
}
