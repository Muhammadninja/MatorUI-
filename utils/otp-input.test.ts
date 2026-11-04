import { describe, expect, test, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import {
  DEFAULT_OTP_LENGTH,
  normalizeOtpInput,
  otpAutofillProps,
  otpPlaceholder,
  resolveOtpLength,
} from './otp-input';

describe('normalizeOtpInput', () => {
  test.each([
    ['typing', '48', '48'],
    ['a full code', '483917', '483917'],
    ['a code with a space', '483 917', '483917'],
    ['a code with a dash', '483-917', '483917'],
    ['a sentence', 'Ваш код: 483917.', '483917'],
    ['a phone number before the code', '+998901234567 483917', '483917'],
    ['letters only', 'abc', ''],
    ['too many digits', '48391755', '483917'],
  ])('%s', (_name, raw, expected) => {
    expect(normalizeOtpInput(raw, 6)).toBe(expected);
  });

  test('backspace and clearing pass through', () => {
    expect(normalizeOtpInput('48391', 6, '483917')).toBe('48391');
    expect(normalizeOtpInput('', 6, '4')).toBe('');
  });

  test('a mid-code correction keeps the edit', () => {
    expect(normalizeOtpInput('483017', 6, '48317')).toBe('483017');
  });

  test('a seventh typed digit is dropped from a full code', () => {
    expect(normalizeOtpInput('4839175', 6, '483917')).toBe('483917');
  });

  test('a suggestion inserted after a partial code replaces it', () => {
    expect(normalizeOtpInput('12483917', 6, '12')).toBe('483917');
  });

  test('a new code inserted after a full one replaces it', () => {
    expect(normalizeOtpInput('123456483917', 6, '123456')).toBe('483917');
  });

  test.each([4, 8])('uses the actual length (%i)', (length) => {
    const code = '12345678'.slice(0, length);
    expect(normalizeOtpInput(code, length)).toBe(code);
    expect(normalizeOtpInput(`${code}9`, length)).toBe(code);
  });
});

describe('resolveOtpLength', () => {
  test.each([4, 6, 8])('accepts %i', (length) => {
    expect(resolveOtpLength(length)).toBe(length);
  });

  test.each([undefined, 0, 3, 9, 5.5, Number.NaN])('falls back on %s', (length) => {
    expect(resolveOtpLength(length)).toBe(DEFAULT_OTP_LENGTH);
  });
});

test('the placeholder matches the code length', () => {
  expect(otpPlaceholder(6)).toBe('123456');
  expect(otpPlaceholder(4)).toBe('1234');
});

describe('otpAutofillProps', () => {
  test('iOS gets only the Security Code AutoFill hint', () => {
    expect(otpAutofillProps('ios')).toEqual({ textContentType: 'oneTimeCode' });
  });

  test('Android gets only the SMS autofill hints', () => {
    expect(otpAutofillProps('android')).toEqual({
      autoComplete: 'sms-otp',
      importantForAutofill: 'yes',
    });
  });

  test('defaults to the running platform', () => {
    expect(otpAutofillProps()).toEqual({ textContentType: 'oneTimeCode' });
  });
});
