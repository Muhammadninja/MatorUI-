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
  const { profile, isAuthenticated } = useUserContext();

  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const firstName = isAuthenticated ? profile?.firstName?.trim() : undefined;
  const greeting = firstName ? `Good ${partOfDay}, ${firstName}` : `Good ${partOfDay}`;

  return (
    <AppView px="md" pt="sm" pb="md" gap={2}>
      <AppText textVariant="bodySm" colorName="textMuted">
        {greeting}
      </AppText>
      <AppText textVariant="h3" family="heading" weight="bold">
        Find your part
      </AppText>
    </AppView>
  );
}
