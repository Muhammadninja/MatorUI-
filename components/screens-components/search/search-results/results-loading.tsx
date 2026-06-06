import SearchResultSkeleton from '@/components/screens-components/search/search-result-skeleton';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

const SKELETON_ROWS = 5;

export type ResultsLoadingProps = {
  query: string;
};

/** Initial loading state: a label plus a stack of shimmer skeleton rows. */
export default function ResultsLoading({ query }: ResultsLoadingProps) {
  return (
    <AppView gap={10} px={16}>
      <AppText textVariant="bodyXs" colorName="gray400">
        Searching for “{query.trim()}”…
      </AppText>
      <AppView gap={14}>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <SearchResultSkeleton key={i} />
        ))}
      </AppView>
    </AppView>
  );
}
