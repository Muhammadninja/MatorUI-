import { useTranslation } from 'react-i18next';

import SearchResultSkeleton from '@/components/screens-components/search/search-result-skeleton';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

const SKELETON_ROWS = 5;

export type ResultsLoadingProps = {
  query: string;
};

/** Initial loading state: a label plus a stack of shimmer skeleton rows.
 *
 *  Padding matches the success list — `paddingHorizontal: 0` so the
 *  skeleton cards sit edge-to-edge, identical to the real rows. The
 *  only horizontal padding belongs to the "Searching for…" label,
 *  which sits inside the regular text gutter. */
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
      <AppView gap={16}>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <SearchResultSkeleton key={i} />
        ))}
      </AppView>
    </AppView>
  );
}
