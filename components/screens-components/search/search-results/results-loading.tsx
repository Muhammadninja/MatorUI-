import { useTranslation } from 'react-i18next';

import SearchResultSkeleton from '@/components/screens-components/search/search-result-skeleton';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

const SKELETON_ROWS = 5;

export type ResultsLoadingProps = {
  query: string;
};

/** Initial loading state: a label plus a stack of shimmer skeleton rows. */
export default function ResultsLoading({ query }: ResultsLoadingProps) {
  const { t } = useTranslation();
  return (
    <AppView gap={10}>
      <AppText
        textVariant="bodyXs"
        colorName="textMuted"
        numberOfLines={2}
        style={{ paddingHorizontal: 16 }}
      >
        {t('search.searchingFor', { query: query.trim() })}
      </AppText>
      <AppView>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <SearchResultSkeleton key={i} />
        ))}
      </AppView>
    </AppView>
  );
}
