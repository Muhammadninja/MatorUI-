import { AppText } from '@/components/shared/app-text';

/** Plain title — substring highlight was removed at the user's request. */
export default function HighlightedTitle({ text }: { text: string; query?: string }) {
  return (
    <AppText
      textVariant="bodySemibold"
      weight="medium"
      numberOfLines={3}
      style={{ flexShrink: 1, fontSize: 14, lineHeight: 19 }}
    >
      {text}
    </AppText>
  );
}
