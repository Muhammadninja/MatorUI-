/**
 * Legal documents & consent — wire types.
 *
 * The backend is the single source of truth for legal content, versions and
 * acceptance state. Nothing in this file (or anywhere else in the app) may
 * hardcode legal text, a title, an effective date, or a version number.
 *
 * Field names are kept in the backend's snake_case rather than camelized,
 * matching the convention the rest of the API layer uses for raw wire shapes
 * (see `RawBackendUser` in auth-api.ts).
 */

/** The three documents the app must surface. Route/branch on this — never on
 *  the localized `title`, which changes with Accept-Language. */
export type LegalDocumentType =
  | 'TERMS_OF_USE'
  | 'PRIVACY_POLICY'
  | 'PERSONAL_DATA_CONSENT';

/** All three types, in the order the UI lists them. */
export const LEGAL_DOCUMENT_TYPES: readonly LegalDocumentType[] = [
  'TERMS_OF_USE',
  'PRIVACY_POLICY',
  'PERSONAL_DATA_CONSENT',
] as const;

/** The one format the app renders as Markdown. Any OTHER value — including
 *  formats the backend adds later — falls back to plain text rather than
 *  failing, so a new server-side format can never break the screen. */
export const MARKDOWN_CONTENT_FORMAT = 'markdown';

export interface LegalDocument {
  type: LegalDocumentType;
  /** Opaque server-provided integer. Never compared, incremented, or
   *  synthesized client-side — the backend owns all version semantics. */
  version: number;
  /** Resolved by the backend from Accept-Language, including regional
   *  fallback (`ru-RU` → `ru`). The client does no locale fallback of its own. */
  locale: string;
  title: string;
  content: string;
  /** Backend VARCHAR, deliberately not narrowed to a union: the server may
   *  introduce new formats without a client release. Compare against
   *  `MARKDOWN_CONTENT_FORMAT`; treat anything else as plain text. */
  content_format: string;
  effective_at: string;
  is_required: boolean;
}

export interface LegalDocumentsResponse {
  documents: LegalDocument[];
}

export interface LegalStatusDocument {
  type: LegalDocumentType;
  required_version: number;
  /** Null when the user has never accepted this document. */
  accepted_version: number | null;
  /** Authoritative per-document verdict. Do NOT recompute this from
   *  `accepted_version >= required_version` — the backend owns that rule. */
  accepted: boolean;
  /** OPTIONAL — the backend omits this field entirely when the document has
   *  never been accepted. Never normalize an absent value into a placeholder. */
  accepted_at?: string;
}

export interface LegalStatusResponse {
  /** The only flag the UI should gate on. */
  requires_acceptance: boolean;
  documents: LegalStatusDocument[];
}

/** One entry of the POST /v1/legal/accept payload. */
export interface LegalAcceptanceInput {
  type: LegalDocumentType;
  version: number;
}

export interface LegalAcceptRequest {
  acceptances: LegalAcceptanceInput[];
}

/**
 * The `legal` block attached to POST /v1/auth/phone/verify-otp when a NEW
 * account is being registered. Versions must come from GET /v1/legal/documents
 * — never a literal.
 */
export interface LegalRegistrationVersions {
  terms_version: number;
  privacy_version: number;
  personal_data_consent_version: number;
}

/** Backend error code returned when required acceptances are missing/stale.
 *  Handled distinctly from an OTP failure. */
export const LEGAL_ACCEPTANCE_REQUIRED = 'LEGAL_ACCEPTANCE_REQUIRED';
