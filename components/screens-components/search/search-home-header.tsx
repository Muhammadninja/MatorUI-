import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useUserContext } from '@/contexts/user.context';

/**
 * Explore (home) greeting header, per the Mator handoff §5: a time-aware
 * greeting line over the "Find your part" title. Uses the REAL signed-in
 * first name when available; guests get an un-personalised greeting (no
 * fabricated name). The notification bell lives in the pinned search bar, so
 * it is intentionally not repeated here.
 */
export default function SearchHomeHeader() {
  const { t } = useTranslation();
  const { profile, isAuthenticated } = useUserContext();

  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const firstName = isAuthenticated ? profile?.firstName?.trim() : undefined;
  const greeting = firstName
    ? t(`search.greeting${partOfDay}Named`, { name: firstName })
    : t(`search.greeting${partOfDay}`);

  return (
    <AppView px="md" pt="sm" pb="md" gap={2}>
      <AppText textVariant="bodySm" colorName="textMuted">
        {greeting}
      </AppText>
      <AppText textVariant="h3" family="heading" weight="bold">
        {t('search.findYourPart')}
      </AppText>
    </AppView>
  );
}
