import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import type { LegalDocumentsState } from '@/hooks/use-legal';
import { orderLegalDocuments, type LegalDocument, type LegalDocumentType } from '@/types/legal';

export type LegalConsentNoteProps = {
  /** Already-translated lead-in, e.g. "By continuing you accept the ". */
  prefix: string;
  /** Straight from `useLegalDocuments()` — the backend is the only source. */
  documents: readonly LegalDocument[];
  state: LegalDocumentsState;
  onOpen: (type: LegalDocumentType) => void;
  onRetry: () => void;
  /** testID of the whole line. */
  testID: string;
  /** Each title link gets `${linkTestIDPrefix}${type}`. */
  linkTestIDPrefix: string;
};

const TEXT_STYLE = { fontSize: 12, lineHeight: 18 } as const;

/**
 * The line under the sign-in sheet's CTA that names every legal document
 * GET /v1/legal/documents returned, each title tappable.
 *
 * Built from the backend response alone: no document, title or version lives
 * here, so all three documents (and any the backend adds later) are listed —
 * the phone step used to hardcode only Terms + Privacy and silently drop
 * PERSONAL_DATA_CONSENT. The titles are the backend's own document names, so
 * the RU/UZ lead-ins end in a colon ("…условия документов: X, Y и Z.") and read
 * correctly whatever case the titles are in.
 */
export function LegalConsentNote({
  prefix,
  documents,
  state,
  onOpen,
  onRetry,
  testID,
  linkTestIDPrefix,
}: LegalConsentNoteProps) {
  const { t } = useTranslation();

  if (documents.length === 0) {
    // Still loading: render nothing rather than a placeholder document.
    if (state === 'loading') return null;
    // Failed (or came back empty): say so and offer a retry — never fill the
    // line with a document the backend didn't send.
    return (
      <AppText testID={`${testID}-error`} family="default" colorName="textMuted" style={TEXT_STYLE}>
        {t('auth.legalDocsLoadError')}{' '}
        <AppText
          family="default"
          weight="semibold"
          underline
          colorName="text"
          accessibilityRole="button"
          style={TEXT_STYLE}
          onPress={onRetry}
        >
          {t('common.retry')}
        </AppText>
      </AppText>
    );
  }

  const ordered = orderLegalDocuments(documents);
  const last = ordered.length - 1;

  return (
    <AppText testID={testID} family="default" colorName="textMuted" style={TEXT_STYLE}>
      {prefix}
      {ordered.map((doc, i) => (
        <Fragment key={doc.type}>
          {i === 0 ? null : i === last ? t('auth.phoneLegalAnd') : t('auth.agreeNoteComma')}
          <AppText
            testID={`${linkTestIDPrefix}${doc.type}`}
            family="default"
            weight="bold"
            underline
            colorName="text"
            accessibilityRole="link"
            style={TEXT_STYLE}
            onPress={() => onOpen(doc.type)}
          >
            {doc.title}
          </AppText>
        </Fragment>
      ))}
      {t('auth.phoneLegalSuffix')}
    </AppText>
  );
}

export default LegalConsentNote;
