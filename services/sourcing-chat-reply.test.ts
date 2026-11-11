import { describe, expect, test } from 'vitest';

import type { TFunction } from 'i18next';

import type { AiChatSourcingState } from '@/types/ai-chat';

import {
  composeSourcingBody,
  interpretSourcingReply,
  SourcingNotConfirmedError,
} from './sourcing-chat-reply';

const PROMISE = 'Наш отдел закупок свяжется с вами в течение 15 минут.';
const signedIn = { isAuthenticated: true, userMessageId: 'user-1' };
const guest = { isAuthenticated: false, userMessageId: 'user-1' };
const item = { id: 'p1', title: 'Фильтр', price: '50 000 сум', category: 'Фильтры' };

describe('confirmation', () => {
  test('a signed-in ticket with an id is received, without the server promise', () => {
    const reply = interpretSourcingReply(
      {
        intent: 'CREATE_SOURCING_TICKET',
        reply_text: PROMISE,
        ticket_id: 't1',
        extracted_data: { part_name: 'радиатор' },
      },
      signedIn,
    );
    expect(reply.text).toBe('');
    expect(reply.sourcing).toEqual({ status: 'received', parts: ['радиатор'], ticketIds: ['t1'] });
  });

  test('a ticket without an id is not confirmation', () => {
    expect(() =>
      interpretSourcingReply({ intent: 'CREATE_SOURCING_TICKET', reply_text: PROMISE }, signedIn),
    ).toThrow(SourcingNotConfirmedError);
  });

  test('an ordinary reply never counts as a request, whatever it says', () => {
    const reply = interpretSourcingReply(
      { intent: 'GENERAL_QUESTION', reply_text: 'Какая деталь?' },
      signedIn,
    );
    expect(reply).toEqual({ text: 'Какая деталь?', partGroups: undefined, sourcing: undefined });
  });
});

describe('guests', () => {
  test('are asked to sign in when the server asks', () => {
    const reply = interpretSourcingReply(
      {
        intent: 'SOURCING_AUTH_REQUIRED',
        reply_text: 'Войдите',
        extracted_data: { part_name: 'радиатор' },
      },
      guest,
    );
    expect(reply.text).toBe('');
    expect(reply.sourcing).toEqual({
      status: 'sign_in_required',
      parts: ['радиатор'],
      userMessageId: 'user-1',
    });
  });

  test('are never told a request was received, even if a ticket came back', () => {
    const reply = interpretSourcingReply(
      { intent: 'CREATE_SOURCING_TICKET', reply_text: PROMISE, ticket_id: 't1' },
      guest,
    );
    expect(reply.sourcing?.status).toBe('sign_in_required');
    expect(reply.text).toBe('');
  });

  test('can still see catalog matches', () => {
    const reply = interpretSourcingReply(
      { intent: 'FOUND_IN_STOCK', reply_text: 'Нашёл', items: [item] },
      guest,
    );
    expect(reply.sourcing).toBeUndefined();
    expect(reply.partGroups?.[0]?.links[0]?.id).toBe('p1');
  });
});

describe('catalog matches', () => {
  test('become links, grouped under the requested part', () => {
    const reply = interpretSourcingReply(
      {
        intent: 'FOUND_IN_STOCK',
        reply_text: 'Нашёл',
        items: [item],
        extracted_data: { part_name: 'фильтр' },
      },
      signedIn,
    );
    expect(reply.text).toBe('Нашёл');
    expect(reply.partGroups).toEqual([
      { partName: 'фильтр', links: [{ id: 'p1', title: 'Фильтр', price: '50 000 сум' }] },
    ]);
  });
});

describe('several parts', () => {
  test('every part keeps its own outcome', () => {
    const reply = interpretSourcingReply(
      {
        intent: 'PARTS_RESULT',
        parts: [
          { part_name: 'салонный фильтр', status: 'FOUND_IN_STOCK', items: [item] },
          { part_name: 'масляный фильтр', status: 'TICKET_CREATED', ticket_id: 't2' },
        ],
      },
      signedIn,
    );
    expect(reply.partGroups?.[0]?.partName).toBe('салонный фильтр');
    expect(reply.sourcing).toEqual({
      status: 'received',
      parts: ['масляный фильтр'],
      ticketIds: ['t2'],
    });
  });

  test('a clarifying question is still asked next to a held part', () => {
    const reply = interpretSourcingReply(
      {
        reply_text: 'Передний или задний?',
        parts: [
          { part_name: 'амортизатор', status: 'NEEDS_CLARIFICATION' },
          { part_name: 'радиатор', status: 'AUTH_REQUIRED' },
        ],
      },
      guest,
    );
    expect(reply.text).toBe('Передний или задний?');
    expect(reply.sourcing?.status).toBe('sign_in_required');
  });

  test('one unconfirmed ticket means nothing is reported as received', () => {
    expect(() =>
      interpretSourcingReply(
        {
          parts: [
            { part_name: 'a', status: 'TICKET_CREATED', ticket_id: 't1' },
            { part_name: 'b', status: 'TICKET_CREATED' },
          ],
        },
        signedIn,
      ),
    ).toThrow(SourcingNotConfirmedError);
  });
});

describe('accounting for everything requested', () => {
  const ticket = {
    intent: 'CREATE_SOURCING_TICKET',
    ticket_id: 't1',
    extracted_data: { part_name: 'салонный фильтр' },
  };

  test('a reply that does not say it covered everything gets a question', () => {
    expect(interpretSourcingReply(ticket, signedIn).partsClarification).toEqual({
      understood: ['салонный фильтр'],
    });
    const found = {
      intent: 'FOUND_IN_STOCK',
      items: [item],
      extracted_data: { part_name: 'фильтр' },
    };
    expect(interpretSourcingReply(found, signedIn).partsClarification).toEqual({
      understood: ['фильтр'],
    });
  });

  test('no question once the server accounts for everything', () => {
    const reply = interpretSourcingReply({ ...ticket, all_parts_accounted: true }, signedIn);
    expect(reply.partsClarification).toBeUndefined();
  });

  test('a false account also gets a question', () => {
    const reply = interpretSourcingReply({ ...ticket, all_parts_accounted: false }, signedIn);
    expect(reply.partsClarification?.understood).toEqual(['салонный фильтр']);
  });

  test('guests are asked too', () => {
    const reply = interpretSourcingReply({ intent: 'SOURCING_AUTH_REQUIRED' }, guest);
    expect(reply.partsClarification).toEqual({ understood: [] });
  });

  test('a part needing clarification with no question from the server still gets one', () => {
    const reply = interpretSourcingReply(
      {
        all_parts_accounted: true,
        parts: [{ part_name: 'амортизатор', status: 'NEEDS_CLARIFICATION' }],
      },
      signedIn,
    );
    expect(reply.partsClarification).toEqual({ understood: [] });
  });

  test('a general reply about no part asks nothing', () => {
    const reply = interpretSourcingReply(
      { intent: 'GENERAL_QUESTION', reply_text: 'Какая деталь?' },
      signedIn,
    );
    expect(reply.partsClarification).toBeUndefined();
  });
});

describe('composeSourcingBody', () => {
  const t = ((key: string, opts?: { parts?: string }) =>
    opts?.parts ? `${key}(${opts.parts})` : key) as unknown as TFunction;
  const received: AiChatSourcingState = {
    status: 'received',
    parts: ['радиатор'],
    ticketIds: ['t1'],
  };

  test('a fully accounted request names its parts', () => {
    expect(composeSourcingBody({ text: '', sourcing: received }, t)).toBe(
      'aiChat.requestReceived\naiChat.requestedParts(радиатор)',
    );
  });

  test('otherwise it asks, naming what was understood', () => {
    expect(
      composeSourcingBody(
        { text: '', sourcing: received, partsClarification: { understood: ['радиатор'] } },
        t,
      ),
    ).toBe('aiChat.requestReceived\n\naiChat.confirmAllParts(радиатор)');
  });

  test('with nothing understood it asks plainly', () => {
    expect(composeSourcingBody({ text: '', partsClarification: { understood: [] } }, t)).toBe(
      'aiChat.askForOtherParts',
    );
  });

  test('ordinary text passes through', () => {
    expect(composeSourcingBody({ text: ' Здравствуйте ' }, t)).toBe('Здравствуйте');
  });
});

describe('real backend replies', () => {
  test('a switched-off backend is not reported as received or as needing sign-in', () => {
    const reply = interpretSourcingReply(
      {
        intent: 'SOURCING_UNAVAILABLE',
        reply_text: 'Не можем принять',
        all_parts_accounted: true,
        parts: [{ part_name: 'радиатор', status: 'UNAVAILABLE' }],
      },
      guest,
    );
    expect(reply.sourcing).toEqual({ status: 'unavailable', parts: ['радиатор'] });
    expect(reply.text).toBe('');
    expect(reply.partsClarification).toBeUndefined();
  });

  test('catalog matches keep their fit, including unknown', () => {
    const reply = interpretSourcingReply(
      {
        intent: 'FOUND_IN_STOCK',
        all_parts_accounted: true,
        parts: [
          {
            part_name: 'фильтр',
            status: 'FOUND_IN_STOCK',
            items: [
              { ...item, id: 'a', fit: 'FITS' },
              { ...item, id: 'b', fit: 'UNKNOWN' },
            ],
          },
        ],
      },
      signedIn,
    );
    expect(reply.partGroups?.[0]?.links.map((l) => l.fit)).toEqual(['FITS', 'UNKNOWN']);
  });
});
