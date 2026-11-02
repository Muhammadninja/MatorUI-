import type { ReactNode } from 'react';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export default function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppView gap={10}>
      <AppText
        textVariant="bodyXs"
        weight="semibold"
        colorName="textMuted"
        style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}
      >
        {title}
      </AppText>
      {children}
    </AppView>
  );
}
