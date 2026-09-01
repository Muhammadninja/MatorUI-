import React from 'react';
import { useTranslation } from 'react-i18next';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppButton } from '@/components/shared/app-button';
import { AppLoadingState } from '@/components/shared/app-loading-state';
import { AppMarkdown } from '@/components/shared/app-markdown';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useLegalDocuments } from '@/hooks/use-legal';
import { MARKDOWN_CONTENT_FORMAT, type LegalDocumentType } from '@/types/legal';

export type LegalDocumentScreenProps = {
  /** Which document to show. Routing keys off the backend type, never the
   *  localized title (which changes with Accept-Language). */
  type: LegalDocumentType;
  /** Where the back button lands when there's no navigation history. */
  fallbackHref?: string;
  /**
   * Override the back action. Used by the mandatory legal gate, which renders
   * this screen inside its own modal rather than as a route — there is nothing
   * to pop, and navigating away would escape the gate.
   */
  onBack?: () => void;
};

/**
 * One backend-driven legal document.
 *
 * All content — title, body, version, effective date — comes from
 * GET /v1/legal/documents. No legal wording exists in this file or in the
 * locale bundles; the only strings here are UI chrome. Body text is rendered
 * through `AppMarkdown`, which has no HTML/WebView path (see utils/markdown).
 */
export default function LegalDocumentScreen({
  type,
  fallbackHref = '/settings-security',
  onBack,
}: LegalDocumentScreenProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { state, byType, error, refresh } = useLegalDocuments();

  const doc = byType(type);
  // The request can succeed while omitting this particular document — treat
  // that as "missing", not as a silent blank page.
  const isMissing = state === 'success' && !doc;

  const headerTitle = doc?.title ?? t(`legal.types.${type}`);

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={headerTitle} fallbackHref={fallbackHref} onBack={onBack} />

      {state === 'loading' ? (
        <AppLoadingState label={t('legal.loading')} />
      ) : state === 'error' || isMissing || state === 'empty' ? (
        <AppView flex={1} center gap={12} px={24}>
          <AppText
            family="default"
            align="center"
            style={{ fontSize: 13.5, lineHeight: 20, color: tokens.textMuted }}
          >
            {state === 'error' ? (error ?? t('legal.loadError')) : t('legal.unavailable')}
          </AppText>
          <AppButton title={t('common.retry')} kind="secondary" size="md" onPress={refresh} />
        </AppView>
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20 }}
        >
          <AppView gap={18}>
            <AppView gap={4}>
              <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text }}>
                {doc!.title}
              </AppText>
              <AppText family="default" style={{ fontSize: 11.5, color: tokens.textMuted }}>
                {t('legal.versionLine', {
                  version: doc!.version,
                  date: formatEffectiveDate(doc!.effective_at),
                })}
              </AppText>
            </AppView>

            {/* `content_format` is a backend VARCHAR: render Markdown only for
                the format we know, and fall back to plain text for anything
                else so a future server-side format degrades instead of
                breaking (and never takes an unsafe HTML path). */}
            {doc!.content_format === MARKDOWN_CONTENT_FORMAT ? (
              <AppMarkdown content={doc!.content} />
            ) : (
              <AppText
                family="default"
                style={{ fontSize: 13.5, lineHeight: 20, color: tokens.textMuted }}
              >
                {doc!.content}
              </AppText>
            )}
          </AppView>
        </AppScrollView>
      )}
    </AppView>
  );
}

/** Backend sends an ISO timestamp; show just the date part. Falls back to the
 *  raw string if it isn't parseable, rather than rendering "Invalid Date". */
function formatEffectiveDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toISOString().slice(0, 10);
}
