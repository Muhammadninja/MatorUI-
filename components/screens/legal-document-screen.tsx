import React from 'react';
import { useTranslation } from 'react-i18next';

import { LegalDocumentBody } from '@/components/screens-components/legal/legal-document-body';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppButton } from '@/components/shared/app-button';
import { AppLoadingState } from '@/components/shared/app-loading-state';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useLegalDocument, useLegalDocuments } from '@/hooks/use-legal';
import { isConsentDocumentType, type LegalDocumentType } from '@/types/legal';

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
 * All content — title, body, version, effective date — comes from the
 * backend: a consent document from GET /v1/legal/documents, an informational
 * one (REFUND_POLICY) from GET /v1/legal/documents/:type. No legal wording
 * exists in this file or in the locale bundles; the only strings here are UI
 * chrome. Body text is rendered through `AppMarkdown`, which has no
 * HTML/WebView path (see utils/markdown).
 */
export default function LegalDocumentScreen({
  type,
  fallbackHref = '/settings-security',
  onBack,
}: LegalDocumentScreenProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const consent = isConsentDocumentType(type);
  const list = useLegalDocuments(consent);
  const single = useLegalDocument(type, !consent);

  const doc = consent ? list.byType(type) : single.document;
  const state = consent ? list.state : single.state;
  const error = consent ? list.error : single.error;
  const refresh = consent ? list.refresh : single.refresh;
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
            style={{ fontSize: 14, lineHeight: 20, color: tokens.textMuted }}
          >
            {state === 'error' ? (error ?? t('legal.loadError')) : t('legal.unavailable')}
          </AppText>
          <AppButton title={t('common.retry')} kind="secondary" size="md" onPress={refresh} />
        </AppView>
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, paddingHorizontal: 16 }}
        >
          <LegalDocumentBody doc={doc!} />
        </AppScrollView>
      )}
    </AppView>
  );
}
