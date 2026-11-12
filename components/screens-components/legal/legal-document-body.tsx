import { AppMarkdown } from '@/components/shared/app-markdown';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useTranslation } from 'react-i18next';
import { MARKDOWN_CONTENT_FORMAT, type LegalDocument } from '@/types/legal';

/**
 * One legal document as the backend served it: title, version line and body.
 * Shared by the legal document screen and the return policy screen, so the
 * text is rendered one way wherever it appears.
 */
export function LegalDocumentBody({ doc }: { doc: LegalDocument }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView gap={18}>
      <AppView gap={4}>
        <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text }}>
          {doc.title}
        </AppText>
        <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted }}>
          {t('legal.versionLine', {
            version: doc.version,
            date: formatEffectiveDate(doc.effective_at),
          })}
        </AppText>
      </AppView>

      {/* `content_format` is a backend VARCHAR: render Markdown only for
          the format we know, and fall back to plain text for anything
          else so a future server-side format degrades instead of
          breaking (and never takes an unsafe HTML path). */}
      {doc.content_format === MARKDOWN_CONTENT_FORMAT ? (
        <AppMarkdown content={doc.content} />
      ) : (
        <AppText family="default" style={{ fontSize: 14, lineHeight: 20, color: tokens.textMuted }}>
          {doc.content}
        </AppText>
      )}
    </AppView>
  );
}

/** Backend sends an ISO timestamp; show just the date part. Falls back to the
 *  raw string if it isn't parseable, rather than rendering "Invalid Date". */
export function formatEffectiveDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toISOString().slice(0, 10);
}
