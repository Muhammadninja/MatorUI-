import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type ResultsHeaderProps = {
  query: string;
  total: number;
  durationMs: number | null;
};

/** List header: result count for the query (+ dev-only timing). */
export default function ResultsHeader({ query, total, durationMs }: ResultsHeaderProps) {
  return (
    <AppView row align="center" justify="space-between" pb={10}>
      <AppText textVariant="bodyXs" colorName="gray400">
        {total} result{total === 1 ? '' : 's'} for “{query.trim()}”
      </AppText>
      {__DEV__ && durationMs != null ? (
        <AppText textVariant="bodyXs" colorName="gray400">
          {durationMs} ms
        </AppText>
      ) : null}
    </AppView>
  );
}
