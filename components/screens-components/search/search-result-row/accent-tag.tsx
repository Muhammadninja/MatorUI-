import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

import type { CardVariant } from './variant';

export default function AccentTag({
  tag,
}: {
  tag: NonNullable<CardVariant['accentTag']>;
}) {
  return (
    <AppView row align="center" gap={4} style={{ alignSelf: 'flex-start' }}>
      <tag.Icon size={14} strokeWidth={2.4} color={tag.color} />
      <AppText
        textVariant="bodyXs"
        weight="semibold"
        style={{ color: tag.color, fontSize: 12 }}
      >
        {tag.label}
      </AppText>
    </AppView>
  );
}
