import { describe, expect, test } from 'vitest';

import { parseSupportContacts } from '@/services/app-config-service';

describe('parseSupportContacts', () => {
  test('keeps well-formed channels', () => {
    expect(
      parseSupportContacts({
        phone: '+998502030318',
        email: 'matorinnovations@gmail.com',
        telegram_username: 'Mator_AutoParts',
      }),
    ).toEqual({
      phone: '+998502030318',
      email: 'matorinnovations@gmail.com',
      telegramUsername: 'Mator_AutoParts',
    });
  });

  test('drops anything a link cannot safely be built from', () => {
    expect(
      parseSupportContacts({
        phone: 'tel:+998502030318',
        email: 'not-an-email',
        telegram_username: 'bad/../name',
      }),
    ).toEqual({ phone: null, email: null, telegramUsername: null });
  });

  test('an older backend without the block offers no channel', () => {
    expect(parseSupportContacts(undefined)).toEqual({
      phone: null,
      email: null,
      telegramUsername: null,
    });
    expect(parseSupportContacts(null).phone).toBeNull();
  });
});
