import { AppText } from '@/components/shared/app-text';

import { SEARCH_FONT } from './fonts';

/** Plain title — substring highlight was removed at the user's request. */
export default function HighlightedTitle({ text }: { text: string; query?: string }) {
  return (
    <AppText
      textVariant="bodySemibold"
      weight="medium"
      style={{
        flexShrink: 1,
        fontFamily: SEARCH_FONT.medium,
        fontSize: 15.5,
        lineHeight: 21,
        letterSpacing: -0.2,
      }}
    >
      {text}
    </AppText>
  );
}
