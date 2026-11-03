import { AppText } from '@/components/shared/app-text';

import { SEARCH_FONT } from './fonts';

/** Plain title — substring highlight was removed at the user's request. Two lines,
 *  then ellipsis; the full name is on Item Detail and in the row's a11y label. */
export default function HighlightedTitle({ text }: { text: string; query?: string }) {
  return (
    <AppText
      textVariant="bodySemibold"
      weight="semibold"
      numberOfLines={2}
      style={{ flexShrink: 1, fontFamily: SEARCH_FONT.semibold, fontSize: 14, lineHeight: 20 }}
    >
      {text}
    </AppText>
  );
}
