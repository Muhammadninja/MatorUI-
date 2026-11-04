import type { TFunction } from 'i18next';

import type {
  AiChatPartGroup,
  AiChatPartsClarification,
  AiChatSourcingState,
} from '@/types/ai-chat';

/** One requested part in a sourcing reply (`docs/backend-sourcing-contract.md`). */
export type SourcingReplyPart = {
  part_name?: string | null;
  status: 'FOUND_IN_STOCK' | 'TICKET_CREATED' | 'AUTH_REQUIRED' | 'NEEDS_CLARIFICATION';
  items?: SourcingReplyItem[];
  ticket_id?: string;
};

type SourcingReplyItem = { id: string; title: string; price: string };

/** Response of POST /api/ai-chat/message. `parts` and `SOURCING_AUTH_REQUIRED`
 *  and `all_parts_accounted` are proposed additions the backend doesn't send yet;
 *  the older single-part shape stays valid. */
export type SourcingChatResponse = {
  reply_text?: string;
  intent?: string;
  extracted_data?: { part_name?: string | null } | null;
  items?: SourcingReplyItem[];
  ticket_id?: string;
  parts?: SourcingReplyPart[];
  /** True only when `parts` or the single-part fields cover every part asked for. */
  all_parts_accounted?: boolean;
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
  const partGroups: AiChatPartGroup[] = [];
  const received: string[] = [];
  const held: string[] = [];
  const ticketIds: string[] = [];
  let ticketOutcome = false;
  let needsClarification = false;
  const parts = partsOf(res);

  for (const part of parts) {
    const name = part.part_name?.trim() || null;
    if (part.status === 'FOUND_IN_STOCK' && part.items?.length) {
      partGroups.push({
        partName: name,
        links: part.items.map(({ id, title, price }) => ({ id, title, price })),
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
    } else if (part.status === 'NEEDS_CLARIFICATION') {
      needsClarification = true;
    }
  }

  let sourcing: AiChatSourcingState | undefined;
  if (ticketOutcome) {
    sourcing =
      isAuthenticated && ticketIds.length > 0
        ? { status: 'received', parts: received, ticketIds }
        : { status: 'sign_in_required', parts: held, userMessageId };
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

/** The reply body: server text, then the app's own wording for the outcome. */
export function composeSourcingBody(
  { text, sourcing, partsClarification }: Omit<InterpretedSourcingReply, 'partGroups'>,
  t: TFunction,
): string {
  const understood = partsClarification?.understood ?? [];
  const outcome = sourcing
    ? [
        t(sourcing.status === 'received' ? 'aiChat.requestReceived' : 'aiChat.signInToSubmitBody'),
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
