import type { TFunction } from 'i18next';

import type {
  AiChatPartGroup,
  AiChatPartsClarification,
  AiChatSourcingState,
} from '@/types/ai-chat';

/** One requested part in a sourcing reply (`docs/backend-sourcing-contract.md`). */
export type SourcingReplyPart = {
  part_name?: string | null;
  status:
    | 'FOUND_IN_STOCK'
    | 'TICKET_CREATED'
    | 'AUTH_REQUIRED'
    | 'NEEDS_CLARIFICATION'
    | 'UNAVAILABLE';
  items?: SourcingReplyItem[];
  ticket_id?: string;
};

type SourcingReplyItem = {
  id: string;
  title: string;
  price: string;
  fit?: 'FITS' | 'UNKNOWN' | null;
};

/** Response of POST /api/ai-chat/message. `parts` and `SOURCING_AUTH_REQUIRED`
 *  and `all_parts_accounted` come with contract version 2; the older single-part
 *  shape stays valid. */
export type SourcingChatResponse = {
  reply_text?: string;
  intent?: string;
  extracted_data?: { part_name?: string | null } | null;
  items?: SourcingReplyItem[];
  ticket_id?: string;
  parts?: SourcingReplyPart[];
  /** True only when `parts` or the single-part fields cover every part asked for. */
  all_parts_accounted?: boolean;
  /** Set on a reply to a photo request (the `PHOTO_*` intents). */
  photo_request?: { part_id: string; part_title?: string | null; status: string } | null;
};

export type InterpretedSourcingReply = {
  /** Server text to show. Empty when the app's own copy describes the outcome. */
  text: string;
  partGroups?: AiChatPartGroup[];
  sourcing?: AiChatSourcingState;
  partsClarification?: AiChatPartsClarification;
};

/** A ticket was reported without an id, so it can't be treated as confirmed. */
export class SourcingNotConfirmedError extends Error {
  constructor() {
    super('Sourcing request was not confirmed by the server');
    this.name = 'SourcingNotConfirmedError';
  }
}

function partsOf(res: SourcingChatResponse): SourcingReplyPart[] {
  if (res.parts?.length) return res.parts;
  const part_name = res.extracted_data?.part_name ?? null;
  if (res.intent === 'FOUND_IN_STOCK' && res.items?.length) {
    return [{ part_name, status: 'FOUND_IN_STOCK', items: res.items }];
  }
  if (res.intent === 'CREATE_SOURCING_TICKET') {
    return [{ part_name, status: 'TICKET_CREATED', ticket_id: res.ticket_id }];
  }
  if (res.intent === 'SOURCING_AUTH_REQUIRED') {
    return [{ part_name, status: 'AUTH_REQUIRED' }];
  }
  return [];
}

/**
 * Decide what a server reply means for the customer. Confirmation is only ever
 * reported for a signed-in customer with a ticket id from the server, whatever
 * the reply text says. A guest can't be sent an offer, so a guest's request is
 * always held for sign-in.
 */
export function interpretSourcingReply(
  res: SourcingChatResponse,
  { isAuthenticated, userMessageId }: { isAuthenticated: boolean; userMessageId?: string },
): InterpretedSourcingReply {
  // A photo request: a guest is held for sign-in exactly like a part request,
  // so the same button signs them in and sends the message again.
  if (res.intent === 'PHOTO_AUTH_REQUIRED') {
    const name = res.photo_request?.part_title?.trim();
    return { text: '', sourcing: { status: 'sign_in_required', parts: name ? [name] : [], userMessageId } };
  }
  if (res.intent?.startsWith('PHOTO_')) return { text: res.reply_text ?? '' };

  const partGroups: AiChatPartGroup[] = [];
  const received: string[] = [];
  const held: string[] = [];
  const ticketIds: string[] = [];
  const unavailable: string[] = [];
  let ticketOutcome = false;
  let needsClarification = false;
  const parts = partsOf(res);

  for (const part of parts) {
    const name = part.part_name?.trim() || null;
    if (part.status === 'FOUND_IN_STOCK' && part.items?.length) {
      partGroups.push({
        partName: name,
        links: part.items.map(({ id, title, price, fit }) => ({ id, title, price, fit })),
      });
    } else if (part.status === 'TICKET_CREATED') {
      if (!part.ticket_id) throw new SourcingNotConfirmedError();
      ticketOutcome = true;
      if (isAuthenticated) {
        ticketIds.push(part.ticket_id);
        if (name) received.push(name);
      } else if (name) {
        held.push(name);
      }
    } else if (part.status === 'AUTH_REQUIRED') {
      ticketOutcome = true;
      if (name) held.push(name);
    } else if (part.status === 'UNAVAILABLE') {
      ticketOutcome = true;
      if (name) unavailable.push(name);
    } else if (part.status === 'NEEDS_CLARIFICATION') {
      needsClarification = true;
    }
  }

  let sourcing: AiChatSourcingState | undefined;
  if (ticketOutcome) {
    const anyHeld = held.length > 0 || parts.some((p) => p.status === 'AUTH_REQUIRED');
    if (isAuthenticated && ticketIds.length > 0) {
      sourcing = { status: 'received', parts: received, ticketIds };
    } else if (unavailable.length > 0 && !anyHeld) {
      sourcing = { status: 'unavailable', parts: unavailable };
    } else {
      sourcing = { status: 'sign_in_required', parts: held, userMessageId };
    }
  }

  return {
    // The ticket text is replaced by the app's copy, so an unsupported promise in
    // it never reaches the customer. A clarifying question must still be asked.
    text: ticketOutcome && !needsClarification ? '' : (res.reply_text ?? ''),
    partGroups: partGroups.length > 0 ? partGroups : undefined,
    sourcing,
    // Showing the part that was understood doesn't tell the customer another was
    // dropped, so anything short of a full account gets an explicit question.
    partsClarification:
      parts.length > 0 &&
      (res.all_parts_accounted !== true || (needsClarification && !res.reply_text?.trim()))
        ? { understood: understoodParts(parts) }
        : undefined,
  };
}

function understoodParts(parts: SourcingReplyPart[]): string[] {
  return parts
    .filter((part) => part.status !== 'NEEDS_CLARIFICATION')
    .map((part) => part.part_name?.trim() ?? '')
    .filter(Boolean);
}

const SOURCING_COPY = {
  received: 'aiChat.requestReceived',
  sign_in_required: 'aiChat.signInToSubmitBody',
  unavailable: 'aiChat.requestsUnavailable',
} as const;

/** The reply body: server text, then the app's own wording for the outcome. */
export function composeSourcingBody(
  { text, sourcing, partsClarification }: Omit<InterpretedSourcingReply, 'partGroups'>,
  t: TFunction,
): string {
  const understood = partsClarification?.understood ?? [];
  const outcome = sourcing
    ? [
        t(SOURCING_COPY[sourcing.status]),
        // The clarifying question already names these.
        sourcing.parts.length > 0 && understood.length === 0
          ? t('aiChat.requestedParts', { parts: sourcing.parts.join(', ') })
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  const question = partsClarification
    ? understood.length > 0
      ? t('aiChat.confirmAllParts', { parts: understood.join(', ') })
      : t('aiChat.askForOtherParts')
    : '';
  return [text.trim(), outcome, question].filter(Boolean).join('\n\n');
}
